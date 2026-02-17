import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isVerified: boolean;
  needsOnboarding: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Combined loading state - true until both auth AND profile are loaded
  const isLoading = isAuthLoading || isProfileLoading;

  const fetchProfile = async (userId: string) => {
    setIsProfileLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      setProfile(profileData as unknown as Profile);

      // Fetch role - prioritize admin role if user has multiple roles
      const { data: rolesData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!roleError && rolesData && rolesData.length > 0) {
        // Prioritize admin > chapter_ambassador > mentor > judge > volunteer > participant
        const rolePriority: AppRole[] = ['admin', 'chapter_ambassador', 'mentor', 'judge', 'volunteer', 'participant'];
        const userRoles = rolesData.map(r => r.role as AppRole);
        const highestRole = rolePriority.find(r => userRoles.includes(r)) || userRoles[0];
        setRole(highestRole);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event);

        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          // Token refreshed or initial session — only update session silently
          // if the access_token actually changed, preventing unnecessary re-renders.
          // INITIAL_SESSION is also handled by getSession() below.
          setSession((prev) => {
            if (prev?.access_token === session?.access_token) return prev;
            return session;
          });
          return;
        }

        if (event === 'SIGNED_IN') {
          // Supabase fires SIGNED_IN both on real login AND on tab visibility
          // recovery (see _recoverAndRefresh in GoTrueClient). We only want to
          // refetch the profile on a genuine new login — not on tab switch.
          setUser((prevUser) => {
            if (prevUser?.id === session?.user?.id) {
              // Same user — tab recovery, not a new login. Skip silently.
              console.log('Auth event: SIGNED_IN ignored (tab recovery, same user)');
              setSession((prev) => {
                if (prev?.access_token === session?.access_token) return prev;
                return session;
              });
              return prevUser;
            }
            // Different user or first login — proceed with full setup
            console.log('Auth event: SIGNED_IN processed (new login)');
            setSession(session);
            if (session?.user) {
              setTimeout(() => fetchProfile(session.user.id), 0);
            }
            return session?.user ?? null;
          });
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'USER_UPDATED') {
          setTimeout(() => fetchProfile(session!.user.id), 0);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setRole(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          setIsAuthLoading(false);
        });
      } else {
        setIsAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const isVerified = profile?.verification_status === 'verified';
  const needsOnboarding = profile ? !profile.onboarding_completed : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isVerified,
        needsOnboarding,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}