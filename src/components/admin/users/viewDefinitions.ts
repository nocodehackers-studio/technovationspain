import { Users, UserPlus, Scale, type LucideIcon } from "lucide-react"

export interface ViewFilter {
  field: string
  value: any
}

export interface ViewConfig {
  id: string
  label: string
  icon: LucideIcon
  filters: ViewFilter[]
  visibleColumns: string[] | "all"
}

export const VIEWS: ViewConfig[] = [
  {
    id: "registrados",
    label: "Registrados",
    icon: Users,
    filters: [
      { field: "onboarding_completed", value: true },
    ],
    visibleColumns: "all",
  },
  {
    id: "sin-registrar",
    label: "Sin Registrar",
    icon: UserPlus,
    filters: [
      { field: "onboarding_completed", value: false },
      { field: "verification_status", value: "verified" },
    ],
    visibleColumns: "all",
  },
  {
    id: "jueces",
    label: "Jueces",
    icon: Scale,
    filters: [
      { field: "is_judge", value: true },
    ],
    visibleColumns: [
      "name",
      "judge_excluded",
      "email",
      "hub_name",
      "judge_external_id",
      "judge_event_id",
      "judge_onboarding_completed",
      "judge_schedule_preference",
      "judge_conflict_other_text",
      "judge_comments",
    ],
  },
]
