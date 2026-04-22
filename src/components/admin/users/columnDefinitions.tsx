import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { RoleBadges } from "@/components/admin/RoleBadge"
import { EditableCell } from "@/components/admin/EditableCell"
import { MoreVertical, Trash2 } from "lucide-react"
import { AppRole, TableCustomColumn } from "@/types/database"
import type { UserWithRoles } from "./useAdminUsersData"

/** All profile field keys mapped to Spanish labels */
export const COLUMN_LABELS: Record<string, string> = {
  // Core / special render
  name: "Nombre",
  roles: "Roles",
  verification_status: "Estado",
  date_of_birth: "Edad",
  created_at: "Registro",
  // Profile text/flag fields
  tg_id: "TG ID",
  first_name: "Nombre (pila)",
  last_name: "Apellidos",
  phone: "Teléfono",
  dni: "DNI",
  postal_code: "Código Postal",
  city: "Ciudad",
  state: "Comunidad",
  chapter: "Chapter",
  school_name: "Colegio/Empresa",
  company_name: "Empresa",
  hub_name: "Hub",
  team_name: "Equipo",
  profile_type: "Tipo de Perfil",
  email: "Email",
  parent_email: "Email del Padre/Madre",
  parent_name: "Nombre del Padre/Madre",
  onboarding_completed: "Registro Completado",
  is_volunteer: "Voluntario",
  is_judge: "Juez",
  is_active: "Activo",
  updated_at: "Última Actualización",
  terms_accepted_at: "Términos Aceptados",
  privacy_accepted_at: "Privacidad Aceptada",
  // Judge assignment fields
  judge_event_id: "Evento (Juez)",
  judge_onboarding_completed: "Onboarding Juez",
  judge_schedule_preference: "Preferencia Horario",
  judge_conflict_other_text: "Conflictos (Juez)",
  judge_comments: "Comentarios (Juez)",
  judge_external_id: "ID Juez Externo",
  judge_excluded: "Excluido",
}

// Fields that are handled by special "core" column renderers
const CORE_COLUMN_IDS = new Set([
  "name",
  "roles",
  "verification_status",
  "date_of_birth",
  "created_at",
])

// Fields that get auto-generated as simple text columns
const AUTO_TEXT_FIELDS: string[] = [
  "email",
  "tg_id",
  "phone",
  "dni",
  "postal_code",
  "city",
  "state",
  "chapter",
  "school_name",
  "company_name",
  "hub_name",
  "team_name",
  "profile_type",
  "parent_email",
  "parent_name",
  "updated_at",
  "terms_accepted_at",
  "privacy_accepted_at",
]

// Boolean fields shown as Sí/No
const BOOLEAN_FIELDS: string[] = [
  "onboarding_completed",
  "is_volunteer",
  "is_judge",
  "is_active",
]

// Judge assignment fields (excluding judge_event_id which has special render)
const JUDGE_TEXT_FIELDS: string[] = [
  "judge_conflict_other_text",
  "judge_comments",
  "judge_external_id",
]

const JUDGE_BOOLEAN_FIELDS: string[] = [
  "judge_onboarding_completed",
]

const SCHEDULE_PREFERENCE_LABELS: Record<string, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  no_preference: "Sin preferencia",
  online_only: "Solo online",
}

// Keys to skip when auto-detecting — handled by core/auto/boolean/judge columns or internal fields
const SKIP_AUTO_DETECT = new Set([
  ...Array.from(CORE_COLUMN_IDS),
  ...AUTO_TEXT_FIELDS,
  ...BOOLEAN_FIELDS,
  ...JUDGE_TEXT_FIELDS,
  ...JUDGE_BOOLEAN_FIELDS,
  "judge_schedule_preference",
  "judge_event_id",
  "judge_excluded",
  "judge_assignment_id",
  "judge_event_name",
  // Internal/join fields not useful as columns
  "id",
  "hub_id",
  "hub",
  "custom_fields",
  "first_name", // shown inside "name" column
  "last_name", // shown inside "name" column
])

function titleCase(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

interface BuildColumnsOptions {
  regionalFinalEvents: { id: string; name: string }[]
  customColumns: TableCustomColumn[]
  onSaveCustomField: (userId: string, fieldKey: string, value: string, currentCustomFields: Record<string, unknown>) => void
  onDeleteColumn: (columnId: string) => void
  onUpdateJudgeEvent: (userId: string, eventId: string | null, existingAssignmentId: string | null) => void
  onToggleJudgeExcluded: (userId: string, excluded: boolean) => void
  /** Pass actual user data keys for auto-detection of new fields */
  dataKeys?: string[]
}

export function buildColumns(options: BuildColumnsOptions): ColumnDef<UserWithRoles>[] {
  const {
    regionalFinalEvents,
    customColumns,
    onSaveCustomField,
    onDeleteColumn,
    onUpdateJudgeEvent,
    onToggleJudgeExcluded,
    dataKeys = [],
  } = options

  const cols: ColumnDef<UserWithRoles>[] = []

  // ── Core columns with custom renderers ──

  cols.push({
    id: "name",
    accessorFn: (row) =>
      `${row.first_name || ""} ${row.last_name || ""} ${row.email || ""} ${row.tg_id || ""} ${row.phone || ""} ${row.team_name || ""} ${row.school_name || ""} ${row.hub_name || ""} ${row.chapter || ""} ${row.city || ""} ${row.state || ""}`.toLowerCase(),
    header: "Nombre",
    enableHiding: true,
    sortingFn: (a, b) => {
      const aFirst = (a.original.first_name ?? "").trim()
      const bFirst = (b.original.first_name ?? "").trim()
      const byFirst = aFirst.localeCompare(bFirst, "es", { sensitivity: "base" })
      if (byFirst !== 0) return byFirst
      const aLast = (a.original.last_name ?? "").trim()
      const bLast = (b.original.last_name ?? "").trim()
      return aLast.localeCompare(bLast, "es", { sensitivity: "base" })
    },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">
          {row.original.first_name} {row.original.last_name}
        </span>
        <span className="text-xs text-muted-foreground">
          {row.original.email}
        </span>
      </div>
    ),
  })

  cols.push({
    accessorKey: "roles",
    header: "Roles",
    enableHiding: true,
    filterFn: (row, _id, value) => {
      const roles = row.original.roles
      if (Array.isArray(value)) return value.some((v: string) => roles.includes(v as AppRole))
      return roles.includes(value as AppRole)
    },
    cell: ({ row }) =>
      row.original.roles.length > 0 ? (
        <RoleBadges roles={row.original.roles} size="sm" />
      ) : (
        <span className="text-muted-foreground text-sm">Sin rol</span>
      ),
  })

  cols.push({
    accessorKey: "verification_status",
    header: "Estado",
    enableHiding: true,
    filterFn: (row, id, value) => {
      const v = row.getValue(id)
      if (Array.isArray(value)) return value.includes(v as string)
      return v === value
    },
    cell: ({ row }) => (
      <StatusBadge status={row.original.verification_status || "pending"} />
    ),
  })

  cols.push({
    accessorKey: "date_of_birth",
    header: "Edad",
    enableHiding: true,
    cell: ({ row }) => {
      const dob = row.original.date_of_birth
      if (!dob) return <span className="text-muted-foreground">—</span>

      const today = new Date()
      const birth = new Date(dob)
      let age = today.getFullYear() - birth.getFullYear()
      const monthDiff = today.getMonth() - birth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--
      }

      const isOutOfRange = age < 8 || age > 18
      return (
        <span className={isOutOfRange ? "text-orange-600 font-medium" : "text-sm"}>
          {age}
        </span>
      )
    },
  })

  cols.push({
    accessorKey: "created_at",
    header: "Registro",
    enableHiding: true,
    cell: ({ row }) => {
      const val = row.original.created_at
      if (!val) return <span className="text-muted-foreground">—</span>
      return (
        <span className="text-sm text-muted-foreground">
          {new Date(val).toLocaleDateString("es-ES")}
        </span>
      )
    },
  })

  // ── Auto-generated simple text columns ──

  for (const field of AUTO_TEXT_FIELDS) {
    const label = COLUMN_LABELS[field] || field
    cols.push({
      accessorKey: field,
      header: label,
      enableHiding: true,
      cell: ({ row }) => {
        const value = (row.original as any)[field]
        // Format date fields
        if (field === "updated_at" || field === "terms_accepted_at" || field === "privacy_accepted_at") {
          return (
            <span className="text-sm text-muted-foreground">
              {value ? new Date(value).toLocaleDateString("es-ES") : "—"}
            </span>
          )
        }
        return <span className="text-sm">{value || "—"}</span>
      },
    })
  }

  // ── Boolean columns ──

  for (const field of BOOLEAN_FIELDS) {
    const label = COLUMN_LABELS[field] || field
    cols.push({
      accessorKey: field,
      header: label,
      enableHiding: true,
      cell: ({ row }) => {
        const value = (row.original as any)[field]
        if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
        return <span className="text-sm">{value ? "Sí" : "No"}</span>
      },
    })
  }

  // ── Judge assignment columns ──

  // Event dropdown
  cols.push({
    id: "judge_event_id",
    accessorKey: "judge_event_id",
    header: "Evento (Juez)",
    enableHiding: true,
    cell: ({ row }) => {
      const user = row.original
      return (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Select
            value={user.judge_event_id || ""}
            onValueChange={(val) => {
              const eventId = val === "__none__" ? null : val
              onUpdateJudgeEvent(user.id, eventId, user.judge_assignment_id || null)
            }}
          >
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="Sin evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin evento</SelectItem>
              {regionalFinalEvents.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    },
  })

  // Judge excluded toggle
  cols.push({
    accessorKey: "judge_excluded",
    header: "Excluido",
    enableHiding: true,
    cell: ({ row }) => {
      const user = row.original
      const excluded = user.judge_excluded ?? false
      return (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <Switch
            checked={excluded}
            onCheckedChange={(checked) => onToggleJudgeExcluded(user.id, checked)}
          />
        </div>
      )
    },
  })

  // Judge boolean fields
  for (const field of JUDGE_BOOLEAN_FIELDS) {
    const label = COLUMN_LABELS[field] || field
    cols.push({
      accessorKey: field,
      header: label,
      enableHiding: true,
      cell: ({ row }) => {
        const value = (row.original as any)[field]
        if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
        return <span className="text-sm">{value ? "Sí" : "No"}</span>
      },
    })
  }

  // Schedule preference
  cols.push({
    accessorKey: "judge_schedule_preference",
    header: "Preferencia Horario",
    enableHiding: true,
    cell: ({ row }) => {
      const value = row.original.judge_schedule_preference
      if (!value) return <span className="text-muted-foreground">—</span>
      return <span className="text-sm">{SCHEDULE_PREFERENCE_LABELS[value] || value}</span>
    },
  })

  // Judge text fields
  for (const field of JUDGE_TEXT_FIELDS) {
    const label = COLUMN_LABELS[field] || field
    cols.push({
      accessorKey: field,
      header: label,
      enableHiding: true,
      cell: ({ row }) => {
        const value = (row.original as any)[field]
        return <span className="text-sm max-w-[200px] truncate block">{value || "—"}</span>
      },
    })
  }

  // ── Custom field columns ──

  for (const col of customColumns) {
    cols.push({
      id: `custom_${col.column_key}`,
      accessorKey: `custom_fields.${col.column_key}`,
      header: () => (
        <div className="flex items-center justify-between gap-2">
          <span>{col.column_label}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteColumn(col.id)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar campo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      enableHiding: true,
      cell: ({ row }) => {
        const customFields = (row.original.custom_fields || {}) as Record<string, unknown>
        const value = (customFields[col.column_key] as string) || ""

        return (
          <EditableCell
            value={value}
            onSave={(newValue) => {
              onSaveCustomField(
                row.original.id,
                col.column_key,
                newValue,
                customFields
              )
            }}
          />
        )
      },
    })
  }

  // ── Auto-detected columns from data keys ──
  // Any key present in actual data but not already handled gets a simple text column
  const handledKeys = new Set(cols.map((c) => (c as any).accessorKey || (c as any).id))
  for (const key of dataKeys) {
    if (SKIP_AUTO_DETECT.has(key) || handledKeys.has(key) || key.startsWith("custom_")) continue
    const label = COLUMN_LABELS[key] || titleCase(key)
    // Add to COLUMN_LABELS at runtime so filter bar can pick it up
    if (!COLUMN_LABELS[key]) COLUMN_LABELS[key] = label
    cols.push({
      accessorKey: key,
      header: label,
      enableHiding: true,
      cell: ({ row }) => {
        const value = (row.original as any)[key]
        if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
        if (typeof value === "boolean") return <span className="text-sm">{value ? "Sí" : "No"}</span>
        return <span className="text-sm">{String(value)}</span>
      },
    })
  }

  return cols
}
