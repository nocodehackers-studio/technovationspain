import { useState, useMemo, useCallback, useRef } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { supabase } from "@/integrations/supabase/client"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { AirtableDataTable, ExportData } from "@/components/admin/AirtableDataTable"
import { format } from "date-fns"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { UserEditSheet } from "@/components/admin/UserEditSheet"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Mail, Loader2 } from "lucide-react"

import { VIEWS } from "@/components/admin/users/viewDefinitions"
import { useAdminUsersData, type UserWithRoles } from "@/components/admin/users/useAdminUsersData"
import { buildColumns, COLUMN_LABELS } from "@/components/admin/users/columnDefinitions"
import { UserViewSelector } from "@/components/admin/users/UserViewSelector"
import {
  DynamicFilterBar,
  type ActiveFilter,
  type FieldOption,
} from "@/components/admin/users/DynamicFilterBar"

// Display value helpers for preset filters
function presetDisplayValue(field: string, value: any): string {
  if (typeof value === "boolean") return value ? "Sí" : "No"
  const statusMap: Record<string, string> = {
    pending: "Pendiente",
    verified: "Verificado",
    manual_review: "Revisión Manual",
    rejected: "Rechazado",
  }
  if (field === "verification_status" && statusMap[value]) return statusMap[value]
  return String(value)
}

export default function AdminUsers() {
  const {
    users,
    isLoading,
    regionalFinalEvents,
    customColumns,
    updateJudgeEvent,
    updateCustomField,
    deleteUser,
    deleteUserMutation,
    addColumn,
    addColumnMutation,
    deleteColumn,
  } = useAdminUsersData()

  const [activeViewId, setActiveViewId] = useState("registrados")
  const [sessionFilters, setSessionFilters] = useState<ActiveFilter[]>([])
  const [removedPresetFilters, setRemovedPresetFilters] = useState<Set<string>>(new Set())
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])

  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addFieldDialogOpen, setAddFieldDialogOpen] = useState(false)
  const [newFieldLabel, setNewFieldLabel] = useState("")
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set())
  const sendingIdsRef = useRef(sendingIds)
  sendingIdsRef.current = sendingIds

  const activeView = useMemo(
    () => VIEWS.find((v) => v.id === activeViewId) || VIEWS[0],
    [activeViewId]
  )

  // When view changes, reset session state
  const handleViewChange = useCallback((viewId: string) => {
    setActiveViewId(viewId)
    setSessionFilters([])
    setRemovedPresetFilters(new Set())
    // Apply view column visibility
    const view = VIEWS.find((v) => v.id === viewId)
    if (view && view.visibleColumns !== "all") {
      // Hide all columns except the ones in the view's list
      const allColumnKeys = Object.keys(COLUMN_LABELS)
      // Also include custom column IDs so they get hidden in restricted views
      const customColKeys = (customColumns || []).map((c) => `custom_${c.column_key}`)
      const visible = new Set(view.visibleColumns)
      const hidden = [...allColumnKeys, ...customColKeys].filter((k) => !visible.has(k))
      setHiddenColumns(hidden)
    } else {
      setHiddenColumns([])
    }
  }, [customColumns])

  // Compute effective preset filters (view presets minus removed ones)
  const effectivePresetFilters: ActiveFilter[] = useMemo(() => {
    return activeView.filters
      .filter((f) => !removedPresetFilters.has(f.field))
      .map((f) => ({
        field: f.field,
        label: COLUMN_LABELS[f.field] || f.field,
        value: f.value,
        displayValue: presetDisplayValue(f.field, f.value),
      }))
  }, [activeView, removedPresetFilters])

  // Apply all filters (preset + session) to data
  const filteredUsers = useMemo(() => {
    if (!users) return []

    const allFilters = [
      ...effectivePresetFilters,
      ...sessionFilters,
    ]

    if (allFilters.length === 0) return users

    return users.filter((user) => {
      return allFilters.every((filter) => {
        const fieldValue = (user as any)[filter.field]

        // Boolean comparison (treat null/undefined as false)
        if (typeof filter.value === "boolean") {
          return (fieldValue ?? false) === filter.value
        }

        // Array field (e.g. roles) — check if array includes the value
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(filter.value)
        }

        // Text search (case-insensitive contains)
        if (typeof filter.value === "string") {
          const actual = String(fieldValue || "").toLowerCase()
          const expected = filter.value.toLowerCase()
          // For exact matches on known discrete values
          if (
            filter.field === "verification_status" ||
            filter.field === "profile_type"
          ) {
            return actual === expected
          }
          // For text filters, use contains
          return actual.includes(expected)
        }

        return fieldValue === filter.value
      })
    })
  }, [users, effectivePresetFilters, sessionFilters])

  // Build available fields for the dynamic filter bar
  const availableFields: FieldOption[] = useMemo(() => {
    const allUsers = users || []

    const buildSelectOptions = (field: string): { value: string; label: string }[] => {
      const values = new Set<string>()
      allUsers.forEach((u) => {
        const v = (u as any)[field]
        if (v && typeof v === "string") values.add(v)
      })
      return Array.from(values)
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v }))
    }

    const fields: FieldOption[] = [
      {
        key: "verification_status",
        label: "Estado",
        type: "select",
        options: [
          { value: "pending", label: "Pendiente" },
          { value: "verified", label: "Verificado" },
          { value: "manual_review", label: "Revisión Manual" },
          { value: "rejected", label: "Rechazado" },
        ],
      },
      {
        key: "roles",
        label: "Roles",
        type: "select",
        options: [
          { value: "participant", label: "Participante" },
          { value: "mentor", label: "Mentor" },
          { value: "collaborator", label: "Colaborador" },
          { value: "chapter_ambassador", label: "Embajador" },
          { value: "admin", label: "Admin" },
        ],
      },
      { key: "hub_name", label: "Hub", type: "select", options: buildSelectOptions("hub_name") },
      { key: "team_name", label: "Equipo", type: "select", options: buildSelectOptions("team_name") },
      { key: "chapter", label: "Chapter", type: "select", options: buildSelectOptions("chapter") },
      { key: "state", label: "Comunidad", type: "select", options: buildSelectOptions("state") },
      { key: "city", label: "Ciudad", type: "select", options: buildSelectOptions("city") },
      { key: "profile_type", label: "Tipo de Perfil", type: "select", options: buildSelectOptions("profile_type") },
      { key: "onboarding_completed", label: "Registro Completado", type: "boolean" },
      { key: "is_volunteer", label: "Voluntario", type: "boolean" },
      { key: "is_judge", label: "Juez", type: "boolean" },
      { key: "is_active", label: "Activo", type: "boolean" },
      { key: "school_name", label: "Colegio/Empresa", type: "text" },
      { key: "phone", label: "Teléfono", type: "text" },
      { key: "dni", label: "DNI", type: "text" },
      { key: "postal_code", label: "Código Postal", type: "text" },
      { key: "parent_email", label: "Email del Padre/Madre", type: "text" },
      { key: "parent_name", label: "Nombre del Padre/Madre", type: "text" },
    ]

    return fields
  }, [users])

  // Derive data keys from first user for auto-column detection
  const dataKeys = useMemo(() => {
    if (!users || users.length === 0) return []
    return Object.keys(users[0])
  }, [users])

  // Build columns
  const columns = useMemo(() => {
    const baseCols = buildColumns({
      regionalFinalEvents,
      customColumns,
      onSaveCustomField: updateCustomField,
      onDeleteColumn: deleteColumn,
      onUpdateJudgeEvent: updateJudgeEvent,
      dataKeys,
    })

    // Add send-reminder action column for "sin-registrar" view
    if (activeViewId === "sin-registrar") {
      const actionCol: ColumnDef<UserWithRoles> = {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const user = row.original
          const isSending = sendingIdsRef.current.has(user.id)
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isSending}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSendReminder(user)
                  }}
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar recordatorio de registro</TooltipContent>
            </Tooltip>
          )
        },
      }
      baseCols.push(actionCol)
    }

    return baseCols
  }, [
    regionalFinalEvents,
    customColumns,
    updateCustomField,
    deleteColumn,
    updateJudgeEvent,
    activeViewId,
    dataKeys,
  ])

  // Send reminder handler
  const handleSendReminder = async (user: UserWithRoles) => {
    setSendingIds((prev) => new Set(prev).add(user.id))
    try {
      const { error } = await supabase.functions.invoke("send-invite-reminder", {
        body: { email: user.email, firstName: user.first_name, lastName: user.last_name },
      })
      if (error) throw error
      toast.success(`Recordatorio enviado a ${user.email}`)
    } catch (err: any) {
      toast.error(err.message || "No se pudo enviar el recordatorio")
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev)
        next.delete(user.id)
        return next
      })
    }
  }

  // Dynamic filter handlers
  const handleAddFilter = useCallback((filter: ActiveFilter) => {
    setSessionFilters((prev) => {
      // Avoid duplicate
      if (prev.some((f) => f.field === filter.field && String(f.value) === String(filter.value))) {
        return prev
      }
      return [...prev, filter]
    })
  }, [])

  const handleRemoveFilter = useCallback((field: string, value: any) => {
    setSessionFilters((prev) =>
      prev.filter((f) => !(f.field === field && String(f.value) === String(value)))
    )
  }, [])

  const handleRemovePresetFilter = useCallback((field: string) => {
    setRemovedPresetFilters((prev) => new Set(prev).add(field))
  }, [])

  // Export handler
  const handleExport = useCallback((exportData: ExportData<UserWithRoles>) => {
    const { rows, visibleColumns } = exportData

    if (rows.length === 0) {
      toast.error("No hay datos para exportar")
      return
    }

    const getColumnValue = (row: UserWithRoles, colId: string): string => {
      switch (colId) {
        case "name":
          return `${row.first_name || ""} ${row.last_name || ""}`.trim()
        case "tg_id":
          return row.tg_id || ""
        case "roles":
          return row.roles.join(", ")
        case "verification_status":
          return row.verification_status || ""
        case "team_name":
          return row.team_name || ""
        case "school_name":
          return row.school_name || ""
        case "hub_name":
          return row.hub_name || ""
        case "chapter":
          return row.chapter || ""
        case "city":
          return row.city || ""
        case "state":
          return row.state || ""
        case "phone":
          return row.phone || ""
        case "date_of_birth":
          return row.date_of_birth || ""
        case "created_at":
          return row.created_at ? format(new Date(row.created_at), "dd/MM/yyyy") : ""
        case "judge_event_name":
        case "judge_event_id":
          return row.judge_event_name || ""
        case "judge_schedule_preference":
          return row.judge_schedule_preference || ""
        case "judge_conflict_other_text":
          return row.judge_conflict_other_text || ""
        case "judge_comments":
          return row.judge_comments || ""
        default:
          if (colId.startsWith("custom_")) {
            const key = colId.replace("custom_", "")
            return (row.custom_fields?.[key] as string) || ""
          }
          // Try direct field access
          return String((row as any)[colId] ?? "")
      }
    }

    const escapeCSV = (val: string): string => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const headers = visibleColumns.map((c) => escapeCSV(c.header))
    const csvRows = [
      headers.join(","),
      ...rows.map((row) =>
        visibleColumns.map((col) => escapeCSV(getColumnValue(row, col.id))).join(",")
      ),
    ]

    const blob = new Blob(["\ufeff" + csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `usuarios_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success(`Exportados ${rows.length} usuarios`)
  }, [])

  const handleDeleteUser = useCallback(() => {
    if (!selectedUser) return
    setDeleteDialogOpen(true)
  }, [selectedUser])

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFieldLabel.trim()) return
    addColumn(newFieldLabel.trim())
    setAddFieldDialogOpen(false)
    setNewFieldLabel("")
  }

  return (
    <AdminLayout title="Gestión de Usuarios">
      <div className="space-y-4 min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los usuarios de la plataforma
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Invitar Usuario</span>
            <span className="sm:hidden">Invitar</span>
          </Button>
        </div>

        {/* View Selector */}
        <UserViewSelector
          views={VIEWS}
          activeViewId={activeViewId}
          onViewChange={handleViewChange}
        />

        {/* Data Table */}
        <AirtableDataTable
          columns={columns}
          data={filteredUsers}
          searchPlaceholder="Buscar por nombre, email, equipo, hub..."
          loading={isLoading}
          externalFilterMode
          hiddenColumns={hiddenColumns}
          onHiddenColumnsChange={setHiddenColumns}
          onAddColumn={() => setAddFieldDialogOpen(true)}
          onRowClick={(user) => {
            setSelectedUser(user as UserWithRoles)
            setEditSheetOpen(true)
          }}
          onExport={handleExport}
          filterBarContent={
            <DynamicFilterBar
              filters={sessionFilters}
              viewPresetFilters={effectivePresetFilters}
              availableFields={availableFields}
              onAddFilter={handleAddFilter}
              onRemoveFilter={handleRemoveFilter}
              onRemovePresetFilter={handleRemovePresetFilter}
            />
          }
        />
      </div>

      {/* Add Field Dialog */}
      <Dialog open={addFieldDialogOpen} onOpenChange={setAddFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Campo Personalizado</DialogTitle>
            <DialogDescription>
              Crea un nuevo campo de texto para almacenar información adicional
              de los usuarios
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddField} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field_label">Nombre del campo</Label>
              <Input
                id="field_label"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="Ej: Notas, Empresa, Origen..."
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddFieldDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={addColumnMutation.isPending}>
                {addColumnMutation.isPending ? "Creando..." : "Crear Campo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Edit Sheet */}
      <UserEditSheet
        user={selectedUser}
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        customColumns={customColumns}
        onDelete={handleDeleteUser}
        canDelete={!!selectedUser}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="¿Eliminar usuario?"
        description={`Esta acción eliminará permanentemente a ${selectedUser?.first_name} ${selectedUser?.last_name}. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (selectedUser) {
            deleteUser(selectedUser.id, () => {
              setDeleteDialogOpen(false)
              setEditSheetOpen(false)
            })
          }
        }}
        loading={deleteUserMutation.isPending}
      />

      {/* Invite User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Usuario</DialogTitle>
            <DialogDescription>
              Se enviará un Magic Link al email indicado
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const email = formData.get("email") as string

              const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                  emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
              })

              if (error) {
                toast.error(`Error: ${error.message}`)
              } else {
                toast.success(`Se ha enviado un Magic Link a ${email}`)
                setCreateDialogOpen(false)
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new_email">Email</Label>
              <Input
                id="new_email"
                name="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Enviar Magic Link</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
