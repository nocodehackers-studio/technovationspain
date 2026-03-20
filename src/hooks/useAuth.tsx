import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole } from '@/types/database';
import { hasMissingFields } from '@/lib/profile-fields';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isVerified: boolean;
  isVolunteer: boolean;
  isJudge: boolean;
  needsJudgeOnboarding: boolean;
  activeJudgeEventId: string | null;
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
  const [activeJudgeEventId, setActiveJudgeEventId] = useState<string | null>(null);
  const [judgeOnboardingCompleted, setJudgeOnboardingCompleted] = useState(true);

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

      // Fetch judge assignment if user is a judge
      if ((profileData as any)?.is_judge) {
        const { data: judgeData } = await supabase
          .from('judge_assignments')
          .select('event_id, onboarding_completed')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (judgeData) {
          setActiveJudgeEventId(judgeData.event_id);
          setJudgeOnboardingCompleted(judgeData.onboarding_completed);
        } else {
          setActiveJudgeEventId(null);
          setJudgeOnboardingCompleted(true);
        }
      } else {
        setActiveJudgeEventId(null);
        setJudgeOnboardingCompleted(true);
      }

      // Fetch role - prioritize admin role if user has multiple roles
      const { data: rolesData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!roleError && rolesData && rolesData.length > 0) {
        // Prioritize admin > chapter_ambassador > mentor > judge > participant
        const rolePriority: AppRole[] = ['admin', 'chapter_ambassador', 'mentor', 'judge', 'collaborator', 'participant'];
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
          setSession((prev) => {
            if (prev?.access_token === session?.access_token) return prev;
            return session;
          });
          return;
        }

        if (event === 'SIGNED_IN') {
          setUser((prevUser) => {
            if (prevUser?.id === session?.user?.id) {
              console.log('Auth event: SIGNED_IN ignored (tab recovery, same user)');
              setSession((prev) => {
                if (prev?.access_token === session?.access_token) return prev;
                return session;
              });
              return prevUser;
            }
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
  const isVolunteer = (profile as any)?.is_volunteer ?? false;
  const isJudge = (profile as any)?.is_judge ?? false;
  const needsJudgeOnboarding = isJudge && activeJudgeEventId !== null && !judgeOnboardingCompleted;
  const needsOnboarding = profile
    ? !profile.terms_accepted_at || hasMissingFields(profile as unknown as Record<string, unknown>) || needsJudgeOnboarding
    : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isVerified,
        isVolunteer,
        isJudge,
        needsJudgeOnboarding,
        activeJudgeEventId,
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
