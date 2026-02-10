import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AirtableDataTable, FilterableColumn } from "@/components/admin/AirtableDataTable";
import { ProfileTypeBadge, ProfileType } from "@/components/admin/import/ProfileTypeBadge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

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

  const handleSendReminder = async (user: UnregisteredUser) => {
    setSendingIds((prev) => new Set(prev).add(user.id));
    try {
      const { error } = await supabase.functions.invoke("send-invite-reminder", {
        body: { email: user.email, firstName: user.first_name, lastName: user.last_name },
      });
      if (error) throw error;
      toast({ title: "Recordatorio enviado", description: `Email enviado a ${user.email}` });
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message || "No se pudo enviar el recordatorio", variant: "destructive" });
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

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
      filterFn: (row, id, value) => {
        const v = row.getValue(id);
        if (Array.isArray(value)) return value.includes(v as string);
        return v === value;
      },
      cell: ({ row }) => (
        <ProfileTypeBadge type={row.original.profile_type as ProfileType} />
      ),
    },
    {
      accessorKey: "team_name",
      header: "Equipo",
      filterFn: (row, id, value) => {
        const v = row.getValue(id) as string | null;
        if (Array.isArray(value)) {
          if (value.includes("__empty__") && !v) return true;
          return value.includes(v as string);
        }
        return v === value;
      },
      cell: ({ row }) => (
        <span className="text-sm">{row.original.team_name || "—"}</span>
      ),
    },
    {
      accessorKey: "city",
      header: "Ciudad",
      filterFn: (row, id, value) => {
        const v = row.getValue(id) as string | null;
        if (Array.isArray(value)) {
          if (value.includes("__empty__") && !v) return true;
          return value.includes(v as string);
        }
        return v === value;
      },
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
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const isSending = sendingIds.has(row.original.id);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isSending}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendReminder(row.original);
                }}
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar recordatorio de registro</TooltipContent>
          </Tooltip>
        );
      },
    },
  ];

  const filterableColumns: FilterableColumn[] = useMemo(() => {
    const data = unregisteredUsers || [];

    const typeOptions: FilterableColumn["options"] = [
      { value: "student", label: "Estudiante" },
      { value: "mentor", label: "Mentor" },
      { value: "judge", label: "Juez" },
      { value: "chapter_ambassador", label: "Embajador" },
    ];

    const teamOpts: FilterableColumn["options"] = [
      { value: "__empty__", label: "Sin equipo" },
    ];
    const cityOpts: FilterableColumn["options"] = [
      { value: "__empty__", label: "Sin ciudad" },
    ];

    const teamSet = new Set<string>();
    const citySet = new Set<string>();

    data.forEach((u) => {
      if (u.team_name && !teamSet.has(u.team_name)) {
        teamSet.add(u.team_name);
        teamOpts.push({ value: u.team_name, label: u.team_name });
      }
      if (u.city && !citySet.has(u.city)) {
        citySet.add(u.city);
        cityOpts.push({ value: u.city, label: u.city });
      }
    });

    const sortOpts = (opts: FilterableColumn["options"]) => {
      const first = opts[0];
      const rest = opts.slice(1).sort((a, b) => a.label.localeCompare(b.label));
      return [first, ...rest];
    };

    return [
      { key: "profile_type", label: "Tipo", options: typeOptions },
      { key: "team_name", label: "Equipo", options: sortOpts(teamOpts) },
      { key: "city", label: "Ciudad", options: sortOpts(cityOpts) },
    ];
  }, [unregisteredUsers]);

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