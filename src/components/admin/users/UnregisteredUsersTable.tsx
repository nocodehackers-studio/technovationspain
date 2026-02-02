import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AirtableDataTable, FilterableColumn } from "@/components/admin/AirtableDataTable";
import { ProfileTypeBadge, ProfileType } from "@/components/admin/import/ProfileTypeBadge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface UnregisteredUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_type: string;
  team_name: string | null;
  city: string | null;
  imported_at: string;
  tg_id: string | null;
}

export function UnregisteredUsersTable() {
  // Fetch unregistered users from authorized_users
  const { data: unregisteredUsers, isLoading } = useQuery({
    queryKey: ["admin-unregistered-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("id, email, first_name, last_name, profile_type, team_name, city, imported_at, tg_id")
        .is("matched_profile_id", null)
        .order("imported_at", { ascending: false });

      if (error) throw error;
      return (data || []) as UnregisteredUser[];
    },
  });

  const columns: ColumnDef<UnregisteredUser>[] = [
    {
      id: "name",
      accessorFn: (row) => 
        `${row.first_name || ""} ${row.last_name || ""} ${row.email || ""} ${row.team_name || ""} ${row.city || ""}`.toLowerCase(),
      header: "Nombre",
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
    },
    {
      accessorKey: "tg_id",
      header: "TG ID",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.tg_id || "—"}</span>
      ),
    },
    {
      accessorKey: "profile_type",
      header: "Tipo",
      filterFn: (row, id, value) => row.getValue(id) === value,
      cell: ({ row }) => (
        <ProfileTypeBadge type={row.original.profile_type as ProfileType} />
      ),
    },
    {
      accessorKey: "team_name",
      header: "Equipo",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.team_name || "—"}</span>
      ),
    },
    {
      accessorKey: "city",
      header: "Ciudad",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.city || "—"}</span>
      ),
    },
    {
      accessorKey: "imported_at",
      header: "Importado",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.imported_at), "dd MMM yyyy", { locale: es })}
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: () => (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          Sin registrar
        </Badge>
      ),
    },
  ];

  const filterableColumns: FilterableColumn[] = [
    {
      key: "profile_type",
      label: "Tipo",
      options: [
        { value: "student", label: "Estudiante" },
        { value: "mentor", label: "Mentor" },
        { value: "judge", label: "Juez" },
        { value: "chapter_ambassador", label: "Embajador" },
      ],
    },
  ];

  return (
    <AirtableDataTable
      columns={columns}
      data={unregisteredUsers || []}
      searchPlaceholder="Buscar por nombre, email, equipo, ciudad..."
      loading={isLoading}
      filterableColumns={filterableColumns}
      onRowClick={() => {}}
    />
  );
}
