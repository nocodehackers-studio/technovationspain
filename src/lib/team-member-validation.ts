import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/database";

export interface MemberValidationResult {
  valid: boolean;
  reason?: string;
  memberType: "participant" | "mentor";
  skipped?: boolean;
}

interface ProfileData {
  id: string;
  verification_status: string | null;
  hub_id: string | null;
}

interface RoleData {
  role: AppRole;
}

interface TeamData {
  hub_id: string | null;
}

// Cache for batch validation to avoid repeated queries
interface ValidationCache {
  profiles: Map<string, ProfileData>;
  roles: Map<string, AppRole[]>;
  teamParticipantCounts: Map<string, number>;
  team: TeamData | null;
}

/**
 * Validates if a user can be added as a member to a team.
 * Implements:
 * - EQ-01: Auto-determine member_type based on user role
 * - EQ-02: Exclude admin users
 * - EQ-03: Only allow verified users
 * - EQ-04: Max 5 participants per team
 * - HB-03: Users must belong to same hub as team (if both have hub)
 */
export async function validateMemberForTeam(
  userId: string,
  teamId: string,
  cache?: ValidationCache
): Promise<MemberValidationResult> {
  try {
    // Get profile data
    let profile: ProfileData | undefined;
    if (cache?.profiles.has(userId)) {
      profile = cache.profiles.get(userId);
    } else {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, verification_status, hub_id")
        .eq("id", userId)
        .single();
      
      if (error || !data) {
        return { valid: false, reason: "Usuario no encontrado", memberType: "participant" };
      }
      profile = data;
      cache?.profiles.set(userId, data);
    }

    // Get user roles
    let userRoles: AppRole[];
    if (cache?.roles.has(userId)) {
      userRoles = cache.roles.get(userId) || [];
    } else {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      
      userRoles = (rolesData || []).map((r: RoleData) => r.role);
      cache?.roles.set(userId, userRoles);
    }

    // Get team data
    let team: TeamData | null;
    if (cache?.team !== undefined) {
      team = cache.team;
    } else {
      const { data: teamData } = await supabase
        .from("teams")
        .select("hub_id")
        .eq("id", teamId)
        .single();
      
      team = teamData;
      if (cache) cache.team = team;
    }

    // EQ-03: Check verification status
    if (profile?.verification_status !== "verified") {
      return {
        valid: false,
        reason: "Solo se pueden vincular usuarios verificados",
        memberType: "participant",
        skipped: true,
      };
    }

    // EQ-02: Check for admin role (admins cannot be team members)
    if (userRoles.includes("admin")) {
      return {
        valid: false,
        reason: "Los administradores no pueden ser miembros de equipos",
        memberType: "participant",
        skipped: true,
      };
    }

    // HB-03: Check hub match (only if both have hub assigned)
    if (team?.hub_id && profile?.hub_id && team.hub_id !== profile.hub_id) {
      return {
        valid: false,
        reason: "El usuario pertenece a un hub diferente al del equipo",
        memberType: "participant",
        skipped: true,
      };
    }

    // EQ-01: Determine member_type based on role
    // Mentor role -> mentor member type
    // All others (participant, judge, volunteer, chapter_ambassador) -> participant
    const memberType: "participant" | "mentor" = userRoles.includes("mentor") ? "mentor" : "participant";

    // EQ-04: Check participant limit (max 5 per team)
    if (memberType === "participant") {
      let currentCount: number;
      if (cache?.teamParticipantCounts.has(teamId)) {
        currentCount = cache.teamParticipantCounts.get(teamId) || 0;
      } else {
        const { count } = await supabase
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("team_id", teamId)
          .eq("member_type", "participant");
        
        currentCount = count || 0;
        cache?.teamParticipantCounts.set(teamId, currentCount);
      }

      if (currentCount >= 5) {
        return {
          valid: false,
          reason: "El equipo ya tiene el máximo de 5 estudiantes",
          memberType,
          skipped: true,
        };
      }

      // Increment for next check if using cache
      if (cache) {
        cache.teamParticipantCounts.set(teamId, currentCount + 1);
      }
    }

    return { valid: true, memberType };
  } catch (error) {
    console.error("Error validating member:", error);
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "Error desconocido",
      memberType: "participant",
    };
  }
}

/**
 * Creates a validation cache for batch operations to minimize database queries
 */
export function createValidationCache(): ValidationCache {
  return {
    profiles: new Map(),
    roles: new Map(),
    teamParticipantCounts: new Map(),
    team: null,
  };
}

/**
 * Pre-fetch profile and role data for multiple user IDs
 */
export async function prefetchUserData(
  userIds: string[],
  cache: ValidationCache
): Promise<void> {
  if (userIds.length === 0) return;

  // Fetch profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, verification_status, hub_id")
    .in("id", userIds);

  profiles?.forEach((p) => {
    cache.profiles.set(p.id, p);
  });

  // Fetch roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds);

  // Group roles by user
  const rolesByUser = new Map<string, AppRole[]>();
  roles?.forEach((r) => {
    const userId = r.user_id;
    if (!rolesByUser.has(userId)) {
      rolesByUser.set(userId, []);
    }
    rolesByUser.get(userId)!.push(r.role);
  });

  rolesByUser.forEach((userRoles, userId) => {
    cache.roles.set(userId, userRoles);
  });
}

/**
 * Pre-fetch team data including current participant counts
 */
export async function prefetchTeamData(
  teamId: string,
  cache: ValidationCache
): Promise<void> {
  // Fetch team
  const { data: team } = await supabase
    .from("teams")
    .select("hub_id")
    .eq("id", teamId)
    .single();

  cache.team = team;

  // Fetch current participant count
  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("member_type", "participant");

  cache.teamParticipantCounts.set(teamId, count || 0);
}
