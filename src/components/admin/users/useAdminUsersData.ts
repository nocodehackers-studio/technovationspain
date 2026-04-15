import { useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { fetchAllRows } from "@/lib/supabase-utils"
import { toast } from "sonner"
import { Profile, AppRole, TableCustomColumn } from "@/types/database"

export type UserWithRoles = Profile & {
  roles: AppRole[]
  team_name?: string | null
  school_name?: string | null
  hub_name?: string | null
  chapter?: string | null
  city?: string | null
  state?: string | null
  profile_type?: string | null
  // Judge assignment fields
  judge_assignment_id?: string | null
  judge_event_id?: string | null
  judge_event_name?: string | null
  judge_onboarding_completed?: boolean | null
  judge_schedule_preference?: string | null
  judge_conflict_other_text?: string | null
  judge_comments?: string | null
  judge_external_id?: string | null
  judge_excluded?: boolean
}

// Slugify column label to create a key
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function useAdminUsersData() {
  const queryClient = useQueryClient()

  // Fetch all users with roles, teams, hub info, and judge assignments
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Fetch ALL profiles (paginated)
      const profiles = await fetchAllRows<Record<string, unknown>>(
        "profiles",
        "*, hub:hubs!profiles_hub_id_fkey(name)",
      )

      // Fetch ALL roles (paginated)
      const roles = await fetchAllRows<{ user_id: string; role: string }>(
        "user_roles",
        "user_id, role",
      )

      // Fetch team memberships with team names (paginated)
      const teamMembers = await fetchAllRows<{ user_id: string; team: { name: string } | null }>(
        "team_members",
        "user_id, team:teams(name)",
      )

      // Fetch judge assignments with event name
      const judgeAssignments = await fetchAllRows<{
        id: string
        user_id: string
        event_id: string | null
        is_active: boolean
        onboarding_completed: boolean
        schedule_preference: string | null
        conflict_other_text: string | null
        comments: string | null
        external_judge_id: string | null
        event: { id: string; name: string } | null
      }>(
        "judge_assignments",
        "*, event:events(id, name)",
      )

      // Build role lookup map
      const rolesByUserId = new Map<string, AppRole[]>()
      for (const r of roles) {
        const existing = rolesByUserId.get(r.user_id) || []
        existing.push(r.role as AppRole)
        rolesByUserId.set(r.user_id, existing)
      }

      // Build team lookup map
      const teamByUserId = new Map<string, string>()
      for (const tm of teamMembers) {
        if (tm.team?.name) teamByUserId.set(tm.user_id, tm.team.name)
      }

      // Build judge assignment lookup map
      const judgeByUserId = new Map<string, (typeof judgeAssignments)[number]>()
      for (const ja of judgeAssignments) {
        judgeByUserId.set(ja.user_id, ja)
      }

      // Merge all data
      const usersWithRoles: UserWithRoles[] = profiles.map((profile) => {
        const userRoles = rolesByUserId.get(profile.id as string) || []
        const profileAny = profile as any
        const judge = judgeByUserId.get(profile.id as string)

        return {
          ...profile,
          custom_fields: (profile.custom_fields as Record<string, unknown>) || {},
          roles: userRoles,
          team_name: teamByUserId.get(profile.id as string) || null,
          school_name: profileAny.school_name || profileAny.company_name || null,
          hub_name: (profile.hub as { name: string } | null)?.name || null,
          chapter: profileAny.chapter || null,
          city: profileAny.city || null,
          state: profileAny.state || null,
          profile_type: profileAny.profile_type || null,
          // Judge assignment fields
          judge_assignment_id: judge?.id || null,
          judge_event_id: judge?.event_id || null,
          judge_event_name: judge?.event?.name || null,
          judge_onboarding_completed: judge?.onboarding_completed ?? null,
          judge_schedule_preference: judge?.schedule_preference || null,
          judge_conflict_other_text: judge?.conflict_other_text || null,
          judge_comments: judge?.comments || null,
          judge_external_id: judge?.external_judge_id || null,
        } as UserWithRoles
      })

      return usersWithRoles
    },
  })

  // Fetch regional final events for the judge event dropdown
  const { data: regionalFinalEvents } = useQuery({
    queryKey: ["admin-regional-final-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name")
        .eq("event_type", "regional_final")
        .order("name")

      if (error) throw error
      return (data || []) as { id: string; name: string }[]
    },
  })

  // Fetch custom columns
  const { data: customColumns } = useQuery({
    queryKey: ["table-custom-columns", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_custom_columns")
        .select("*")
        .eq("table_name", "profiles")
        .order("sort_order")

      if (error) throw error
      return (data || []) as TableCustomColumn[]
    },
  })

  // Update judge event assignment mutation
  const updateJudgeEventMutation = useMutation({
    mutationFn: async ({
      userId,
      eventId,
      existingAssignmentId,
    }: {
      userId: string
      eventId: string | null
      existingAssignmentId: string | null
    }) => {
      if (existingAssignmentId) {
        // Update existing assignment
        const { error } = await supabase
          .from("judge_assignments")
          .update({ event_id: eventId })
          .eq("id", existingAssignmentId)

        if (error) throw error
      } else if (eventId) {
        // Create new assignment only if there's an actual event to assign
        const { error } = await supabase
          .from("judge_assignments")
          .insert({ user_id: userId, event_id: eventId })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      toast.success("Evento del juez actualizado")
    },
    onError: (error) => {
      toast.error(`Error al actualizar evento: ${error.message}`)
    },
  })

  // Toggle judge excluded mutation
  const toggleJudgeExcludedMutation = useMutation({
    mutationFn: async ({ userId, excluded }: { userId: string; excluded: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ judge_excluded: excluded })
        .eq("id", userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      toast.success("Estado de exclusión actualizado")
    },
    onError: (error) => {
      toast.error(`Error al actualizar exclusión: ${error.message}`)
    },
  })

  // Update custom field mutation
  const updateCustomFieldMutation = useMutation({
    mutationFn: async ({
      userId,
      fieldKey,
      value,
      currentCustomFields,
    }: {
      userId: string
      fieldKey: string
      value: string
      currentCustomFields: Record<string, unknown>
    }) => {
      const updatedFields = {
        ...currentCustomFields,
        [fieldKey]: value,
      }

      const { error } = await supabase
        .from("profiles")
        .update({ custom_fields: updatedFields as unknown as Record<string, never> })
        .eq("id", userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error) => {
      toast.error(`Error al guardar: ${error.message}`)
    },
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      toast.success("Usuario eliminado correctamente")
    },
    onError: (error) => {
      toast.error(`Error al eliminar: ${error.message}`)
    },
  })

  // Add custom column mutation
  const addColumnMutation = useMutation({
    mutationFn: async (label: string) => {
      const columnKey = slugify(label)
      const { error } = await supabase.from("table_custom_columns").insert({
        table_name: "profiles",
        column_key: columnKey,
        column_label: label,
        column_type: "text",
        sort_order: (customColumns?.length || 0) + 1,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-custom-columns", "profiles"] })
      toast.success("Campo creado correctamente")
    },
    onError: (error) => {
      toast.error(`Error al crear campo: ${error.message}`)
    },
  })

  // Delete custom column mutation
  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const { error } = await supabase
        .from("table_custom_columns")
        .delete()
        .eq("id", columnId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-custom-columns", "profiles"] })
      toast.success("Campo eliminado correctamente")
    },
    onError: (error) => {
      toast.error(`Error al eliminar campo: ${error.message}`)
    },
  })

  // Stable callbacks
  const updateJudgeEvent = useCallback(
    (userId: string, eventId: string | null, existingAssignmentId: string | null) => {
      updateJudgeEventMutation.mutate({ userId, eventId, existingAssignmentId })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const toggleJudgeExcluded = useCallback(
    (userId: string, excluded: boolean) => {
      toggleJudgeExcludedMutation.mutate({ userId, excluded })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const updateCustomField = useCallback(
    (userId: string, fieldKey: string, value: string, currentCustomFields: Record<string, unknown>) => {
      updateCustomFieldMutation.mutate({ userId, fieldKey, value, currentCustomFields })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const deleteUser = useCallback(
    (userId: string, onSuccess?: () => void) => {
      deleteUserMutation.mutate(userId, { onSuccess })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const addColumn = useCallback(
    (label: string) => {
      addColumnMutation.mutate(label)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const deleteColumn = useCallback(
    (columnId: string) => {
      deleteColumnMutation.mutate(columnId)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return {
    users,
    isLoading,
    regionalFinalEvents: regionalFinalEvents || [],
    customColumns: customColumns || [],
    updateJudgeEvent,
    toggleJudgeExcluded,
    updateCustomField,
    deleteUser,
    deleteUserMutation,
    addColumn,
    addColumnMutation,
    deleteColumn,
  }
}
