import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/admin/MetricCard";
import { AirtableDataTable, FilterableColumn, ExportData } from "@/components/admin/AirtableDataTable";
import { RegistrationStatusBadge } from "@/components/events/RegistrationStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminCancelRegistration } from "@/hooks/useAdminCancelRegistration";
import { useAdminPromoteWaitlist, checkWaitlistCapacity } from "@/hooks/useAdminPromoteWaitlist";
import { useEventTeamStats } from "@/hooks/useEventTeamStats";
import { TeamRegistrationSummary } from "./TeamRegistrationSummary";
import { isMinor } from "@/lib/age-utils";
import { Users, Users2, UserPlus, GraduationCap, Ticket, UsersRound, XCircle, FileCheck, Mail, Loader2, AlertTriangle, Clock, Send, ScanLine } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EventStatsViewProps {
  eventId: string;
}

interface RegistrationWithCompanions {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dni: string | null;
  registration_status: string | null;
  checked_in_at: string | null;
  created_at: string | null;
  registration_number: string | null;
  team_name: string | null;
  ticket_type: {
    id: string;
    name: string;
    allowed_roles: string[] | null;
  } | null;
  companions_count: number;
  companions_details: {
    first_name: string | null;
    last_name: string | null;
    relationship: string | null;
    dni: string | null;
    checked_in_at: string | null;
  }[];
  has_consent: boolean;
  consent_signed_at: string | null;
  date_of_birth: string | null;
  chapter: string | null;
  hub_name: string | null;
  // Derived fields for filtering
  ticket_type_name: string;
  consent_status: string;
}

export function EventStatsView({ eventId }: EventStatsViewProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [registrationToCancel, setRegistrationToCancel] = useState<RegistrationWithCompanions | null>(null);
  const [registrationToPromote, setRegistrationToPromote] = useState<RegistrationWithCompanions | null>(null);
  const [promoteCapacityWarning, setPromoteCapacityWarning] = useState<{ currentCount: number; maxCapacity: number } | null>(null);
  const [promotingIds, setPromotingIds] = useState<Set<string>>(new Set());
  const [hiddenColumns] = useState<string[]>(["dni", "phone"]);
  const [sendingConsentIds, setSendingConsentIds] = useState<Set<string>>(new Set());
  const [resendingEntryIds, setResendingEntryIds] = useState<Set<string>>(new Set());
  const [registrationToResend, setRegistrationToResend] = useState<RegistrationWithCompanions | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [showCancelled, setShowCancelled] = useState(false);
  const [bulkConsentSending, setBulkConsentSending] = useState(false);
  const [bulkConsentProgress, setBulkConsentProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [showBulkConsentConfirm, setShowBulkConsentConfirm] = useState(false);
  const [bulkEntrySending, setBulkEntrySending] = useState(false);
  const [bulkEntryProgress, setBulkEntryProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [showBulkEntryConfirm, setShowBulkEntryConfirm] = useState(false);
  const cancelMutation = useAdminCancelRegistration();
  const promoteMutation = useAdminPromoteWaitlist();
  const { data: teamStats, isLoading: teamStatsLoading } = useEventTeamStats(eventId);
  const queryClient = useQueryClient();

  // Mutation for toggling team validated status
  const toggleValidatedMutation = useMutation({
    mutationFn: async ({ teamId, validated }: { teamId: string; validated: boolean }) => {
      const { error } = await supabase
        .from("teams")
        .update({ validated })
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-team-stats", eventId] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el estado de validación", variant: "destructive" });
    },
  });

  const handleResendConsent = async (registration: RegistrationWithCompanions) => {
    setSendingConsentIds((prev) => new Set(prev).add(registration.id));
    try {
      const { data, error } = await supabase.functions.invoke("send-event-consent", {
        body: { registrationId: registration.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Email enviado",
        description: `Consentimiento reenviado para ${registration.first_name || ""} ${registration.last_name || ""}`.trim(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo enviar el email";
      toast({
        title: "Error al enviar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSendingConsentIds((prev) => {
        const next = new Set(prev);
        next.delete(registration.id);
        return next;
      });
    }
  };

  const handleResendEntry = async (registration: RegistrationWithCompanions) => {
    if (registration.registration_status !== "confirmed") return;
    if (resendingEntryIds.has(registration.id)) return;
    setResendingEntryIds((prev) => new Set(prev).add(registration.id));
    try {
      const { data, error } = await supabase.functions.invoke("send-registration-confirmation", {
        body: { registrationId: registration.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const name = `${registration.first_name || ""} ${registration.last_name || ""}`.trim();
      toast({
        title: "Email enviado",
        description: `Entrada reenviada a ${name || registration.email || "(sin nombre)"}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo enviar el email";
      toast({
        title: "Error al enviar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setResendingEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(registration.id);
        return next;
      });
    }
  };

  const handlePromoteClick = async (registration: RegistrationWithCompanions) => {
    if (!registration.ticket_type?.id) return;
    setPromotingIds((prev) => new Set(prev).add(registration.id));
    try {
      const capacity = await checkWaitlistCapacity(registration.ticket_type.id);
      if (capacity.exceedsCapacity) {
        setPromoteCapacityWarning({ currentCount: capacity.currentCount, maxCapacity: capacity.maxCapacity });
        setRegistrationToPromote(registration);
      } else {
        await promoteMutation.mutateAsync({
          registrationId: registration.id,
          eventId: eventId,
          ticketTypeId: registration.ticket_type.id,
        });
      }
    } catch (err) {
      // F8 fix: surface capacity check errors (mutation errors handled by onError)
      if (err instanceof Error && !err.message.includes("procesada")) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } finally {
      setPromotingIds((prev) => {
        const next = new Set(prev);
        next.delete(registration.id);
        return next;
      });
    }
  };

  const handleConfirmPromote = async () => {
    if (!registrationToPromote?.ticket_type?.id) return;
    setPromotingIds((prev) => new Set(prev).add(registrationToPromote.id));
    try {
      await promoteMutation.mutateAsync({
        registrationId: registrationToPromote.id,
        eventId: eventId,
        ticketTypeId: registrationToPromote.ticket_type.id,
      });
    } finally {
      setPromotingIds((prev) => {
        const next = new Set(prev);
        next.delete(registrationToPromote.id);
        return next;
      });
      setRegistrationToPromote(null);
      setPromoteCapacityWarning(null);
    }
  };

  // Fetch event data
  const { data: event } = useQuery({
    queryKey: ["event-stats", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("max_capacity, current_registrations")
        .eq("id", eventId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch registrations with ticket types and consent
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["event-registrations-stats", eventId],
    queryFn: async () => {
      const { data: regs, error } = await supabase
        .from("event_registrations")
        .select(`
          id, user_id, first_name, last_name, email, phone, dni, registration_status,
          checked_in_at, created_at, registration_number, team_name,
          ticket_type:event_ticket_types(id, name, allowed_roles),
          consent:event_ticket_consents(id, signed_at)
        `)
        .eq("event_id", eventId)
        .eq("is_companion", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get companion details
      const regIds = regs?.map((r) => r.id) || [];
      if (regIds.length === 0) return [];

      // Fetch profile data (date_of_birth, chapter, hub) separately
      const userIds = regs?.map((r) => r.user_id).filter(Boolean) || [];
      const profileMap = new Map<string, { date_of_birth: string | null; chapter: string | null; hub_name: string | null }>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, date_of_birth, chapter, hub_id")
          .in("id", userIds);

        // Collect hub_ids to resolve names
        const hubIds = [...new Set((profiles || []).map(p => p.hub_id).filter(Boolean))] as string[];
        const hubMap = new Map<string, string>();

        if (hubIds.length > 0) {
          const { data: hubs } = await supabase
            .from("hubs")
            .select("id, name")
            .in("id", hubIds);
          hubs?.forEach(h => hubMap.set(h.id, h.name));
        }

        profiles?.forEach(p => {
          profileMap.set(p.id, {
            date_of_birth: p.date_of_birth || null,
            chapter: p.chapter || null,
            hub_name: p.hub_id ? (hubMap.get(p.hub_id) || null) : null,
          });
        });
      }

      const { data: companions } = await supabase
        .from("companions")
        .select("event_registration_id, first_name, last_name, relationship, dni, checked_in_at")
        .in("event_registration_id", regIds);

      const companionCounts: Record<string, number> = {};
      const companionDetails: Record<string, RegistrationWithCompanions["companions_details"]> = {};
      companions?.forEach((c) => {
        if (c.event_registration_id) {
          companionCounts[c.event_registration_id] = (companionCounts[c.event_registration_id] || 0) + 1;
          if (!companionDetails[c.event_registration_id]) companionDetails[c.event_registration_id] = [];
          companionDetails[c.event_registration_id].push({
            first_name: c.first_name,
            last_name: c.last_name,
            relationship: c.relationship,
            dni: c.dni,
            checked_in_at: c.checked_in_at,
          });
        }
      });

      return regs?.map((r) => {
        // Supabase returns one-to-one relations as object, one-to-many as array
        const raw = r.consent as unknown;
        const consentRecord = raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as { id: string; signed_at: string })
          : Array.isArray(raw) && raw.length > 0
            ? (raw[0] as { id: string; signed_at: string })
            : null;

        // Extract profile data
        const profileData = profileMap.get(r.user_id);
        const dateOfBirth = profileData?.date_of_birth || null;
        const hasConsent = !!consentRecord;

        // Determine consent status based on age
        // Adults (14+ by cycle date) give implicit consent at registration — only minors (≤13 by cycle date) need explicit parental consent
        let consentStatus: string;
        if (hasConsent || !isMinor(dateOfBirth)) {
          consentStatus = "signed";
        } else {
          consentStatus = "pending_minor";
        }

        return {
          ...r,
          companions_count: companionCounts[r.id] || 0,
          companions_details: companionDetails[r.id] || [],
          has_consent: hasConsent,
          consent_signed_at: consentRecord?.signed_at || null,
          date_of_birth: dateOfBirth,
          chapter: profileData?.chapter || null,
          hub_name: profileData?.hub_name || null,
          ticket_type_name: r.ticket_type?.name || "",
          consent_status: consentStatus,
        };
      }) as RegistrationWithCompanions[];
    },
  });

  // Hide cancelled by default; when user applies any status filter, pass all data
  // and let the table's filterFn handle the filtering
  const displayedRegistrations = useMemo(() => {
    const regs = registrations || [];
    const statusFilters = activeFilters["registration_status"];
    if (statusFilters && statusFilters.length > 0) {
      return regs;
    }
    if (showCancelled) {
      return regs.filter((r) => r.registration_status === "cancelled");
    }
    return regs.filter((r) => r.registration_status !== "cancelled");
  }, [registrations, activeFilters, showCancelled]);

  const isPendingMinorFilterActive = activeFilters["consent_status"]?.includes("pending_minor") && activeFilters["consent_status"]?.length === 1;

  const pendingMinorRegistrations = useMemo(
    () => (registrations || []).filter((r) => r.consent_status === "pending_minor" && r.registration_status !== "cancelled"),
    [registrations]
  );

  const confirmedRegistrations = useMemo(
    () => (registrations || []).filter((r) => r.registration_status === "confirmed"),
    [registrations]
  );

  const handleBulkConsentSend = async () => {
    const targets = pendingMinorRegistrations;
    if (targets.length === 0) return;

    setBulkConsentSending(true);
    setBulkConsentProgress({ sent: 0, failed: 0, total: targets.length });

    let sent = 0;
    let failed = 0;

    for (const registration of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("send-event-consent", {
          body: { registrationId: registration.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        sent++;
      } catch {
        failed++;
      }
      setBulkConsentProgress({ sent, failed, total: targets.length });
      await new Promise((r) => setTimeout(r, 100));
    }

    if (failed === 0) {
      toast({
        title: "Envío masivo completado",
        description: `${sent} email${sent !== 1 ? "s" : ""} de consentimiento enviado${sent !== 1 ? "s" : ""} correctamente.`,
      });
    } else {
      toast({
        title: "Envío masivo completado con errores",
        description: `${sent} enviado${sent !== 1 ? "s" : ""}, ${failed} fallido${failed !== 1 ? "s" : ""}.`,
        variant: "destructive",
      });
    }

    setBulkConsentSending(false);
    setBulkConsentProgress(null);
    setShowBulkConsentConfirm(false);
  };

  const handleBulkEntrySend = async () => {
    if (bulkEntrySending) return;
    const targets = confirmedRegistrations;
    if (targets.length === 0) return;

    setBulkEntrySending(true);
    setBulkEntryProgress({ sent: 0, failed: 0, total: targets.length });

    let sent = 0;
    let failed = 0;

    for (const registration of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("send-registration-confirmation", {
          body: { registrationId: registration.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        sent++;
      } catch (err) {
        console.error(`Failed to resend entry email for registration ${registration.id}:`, err);
        failed++;
      }
      setBulkEntryProgress({ sent, failed, total: targets.length });
      await new Promise((r) => setTimeout(r, 100));
    }

    if (failed === 0) {
      toast({
        title: "Envío masivo completado",
        description: `${sent} entrada${sent !== 1 ? "s" : ""} reenviada${sent !== 1 ? "s" : ""} correctamente.`,
      });
    } else {
      toast({
        title: "Envío masivo completado con errores",
        description: `${sent} enviada${sent !== 1 ? "s" : ""}, ${failed} fallida${failed !== 1 ? "s" : ""}.`,
        variant: "destructive",
      });
    }

    setBulkEntrySending(false);
    setBulkEntryProgress(null);
    setShowBulkEntryConfirm(false);
  };

  // Fetch total companions count for metrics
  const { data: allCompanions } = useQuery({
    queryKey: ["event-companions-count", eventId],
    queryFn: async () => {
      const { data: regIds } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("is_companion", false);

      if (!regIds || regIds.length === 0) return [];

      const { data, error } = await supabase
        .from("companions")
        .select("id")
        .in(
          "event_registration_id",
          regIds.map((r) => r.id)
        );

      if (error) throw error;
      return data || [];
    },
  });

  // Detect participants registered in inactive/previous-season teams
  const { data: inactiveTeamMembers } = useQuery({
    queryKey: ["event-inactive-team-members", eventId],
    enabled: !!registrations && registrations.length > 0,
    queryFn: async () => {
      const userIds = registrations!.map((r) => r.user_id).filter(Boolean);
      if (userIds.length === 0) return [];

      const { data: memberships } = await supabase
        .from("team_members")
        .select("user_id, team:teams!team_members_team_id_fkey(id, name, status, season)")
        .in("user_id", userIds);

      if (!memberships) return [];

      const usersWithActiveTeam = new Set<string>();
      const inactiveEntries: Array<{
        userId: string;
        teamName: string;
        season: string | null;
      }> = [];

      for (const m of memberships) {
        const team = m.team as unknown as { id: string; name: string; status: string; season: string | null } | null;
        if (!team) continue;

        if (team.status === "active") {
          usersWithActiveTeam.add(m.user_id);
        } else {
          inactiveEntries.push({
            userId: m.user_id,
            teamName: team.name,
            season: team.season,
          });
        }
      }

      const results: Array<{
        userId: string;
        name: string;
        email: string;
        teamName: string;
        season: string | null;
      }> = [];

      for (const entry of inactiveEntries) {
        if (usersWithActiveTeam.has(entry.userId)) continue;

        const reg = registrations!.find((r) => r.user_id === entry.userId);
        if (!reg) continue;

        if (results.some((r) => r.userId === entry.userId)) continue;

        results.push({
          userId: entry.userId,
          name: `${reg.first_name || ""} ${reg.last_name || ""}`.trim(),
          email: reg.email || "",
          teamName: entry.teamName,
          season: entry.season,
        });
      }

      return results;
    },
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const regs = registrations || [];
    // F5 fix: exclude waitlisted from confirmed-attendee metrics
    const confirmedRegs = regs.filter((r) => r.registration_status !== "waitlisted" && r.registration_status !== "cancelled");

    const participantsCount = confirmedRegs.filter((r) =>
      r.ticket_type?.allowed_roles?.includes("participant")
    ).length;

    const mentorsCount = confirmedRegs.filter(
      (r) =>
        r.ticket_type?.allowed_roles?.includes("mentor") ||
        r.ticket_type?.allowed_roles?.includes("collaborator")
    ).length;

    const companionsCount = allCompanions?.length || 0;
    const mainRegistrations = confirmedRegs.length;
    const totalAttendees = mainRegistrations + companionsCount;

    const remainingTickets = Math.max(
      0,
      (event?.max_capacity || 0) - totalAttendees
    );

    const consentsTotal = confirmedRegs.length;
    const consentsSigned = confirmedRegs.filter((r) => r.has_consent).length;

    const waitlistedCount = regs.filter((r) => r.registration_status === "waitlisted").length;

    return {
      participantsCount,
      mentorsCount,
      companionsCount,
      mainRegistrations,
      totalAttendees,
      remainingTickets,
      consentsTotal,
      consentsSigned,
      waitlistedCount,
    };
  }, [registrations, allCompanions, event]);

  // Filterable columns
  const filterableColumns: FilterableColumn[] = useMemo(() => {
    const regs = registrations || [];
    const ticketTypes = [...new Set(regs.map((r) => r.ticket_type?.name).filter(Boolean))];
    const teams = [...new Set(regs.map((r) => r.team_name).filter(Boolean))].sort();
    const chapters = [...new Set(regs.map((r) => r.chapter).filter(Boolean))].sort();
    const hubs = [...new Set(regs.map((r) => r.hub_name).filter(Boolean))].sort();

    return [
      {
        key: "ticket_type_name",
        label: "Tipo Entrada",
        options: ticketTypes.map((t) => ({ value: t!, label: t! })),
      },
      {
        key: "registration_status",
        label: "Estado",
        options: [
          { value: "confirmed", label: "Confirmado" },
          { value: "waitlisted", label: "En lista de espera" },
          { value: "cancelled", label: "Cancelado" },
        ],
      },
      {
        key: "consent_status",
        label: "Consentimiento",
        options: [
          { value: "signed", label: "Firmado" },
          { value: "pending_minor", label: "Pendiente padre (menor según ciclo)" },
        ],
      },
      ...(chapters.length > 0
        ? [
            {
              key: "chapter",
              label: "Chapter",
              options: chapters.map((c) => ({ value: c!, label: c! })),
            },
          ]
        : []),
      ...(hubs.length > 0
        ? [
            {
              key: "hub_name",
              label: "Hub",
              options: hubs.map((h) => ({ value: h!, label: h! })),
            },
          ]
        : []),
      ...(teams.length > 0
        ? [
            {
              key: "team_name",
              label: "Equipo",
              options: [
                ...teams.map((t) => ({ value: t!, label: t! })),
                { value: "__empty__", label: "Sin equipo" },
              ],
            },
          ]
        : []),
    ];
  }, [registrations]);

  // Table columns
  const columns: ColumnDef<RegistrationWithCompanions>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Nombre",
        accessorFn: (row) =>
          `${row.first_name || ""} ${row.last_name || ""} ${row.email || ""}`.trim().toLowerCase(),
        cell: ({ row }) => {
          const name = `${row.original.first_name || ""} ${row.original.last_name || ""}`.trim();
          return (
            <div>
              <p className="font-medium">{name || "-"}</p>
              <p className="text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "dni",
        header: "DNI",
        cell: ({ row }) => (
          <span className="text-sm font-mono">{row.original.dni || "-"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Teléfono",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.phone || "-"}</span>
        ),
      },
      {
        accessorKey: "team_name",
        header: "Equipo",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          const value = row.original.team_name;
          if (filterValues.includes("__empty__") && !value) return true;
          return filterValues.includes(value || "");
        },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.team_name || "-"}</span>
        ),
      },
      {
        accessorKey: "ticket_type_name",
        header: "Tipo Entrada",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          return filterValues.includes(row.original.ticket_type_name);
        },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.ticket_type?.name || "-"}</span>
        ),
      },
      {
        accessorKey: "companions_count",
        header: "Acomp.",
        cell: ({ row }) => {
          const count = row.original.companions_count;
          if (count === 0) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <Badge variant="secondary" className="font-mono">
              +{count}
            </Badge>
          );
        },
      },
      {
        accessorKey: "consent_status",
        header: "Consentimiento",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          return filterValues.includes(row.original.consent_status);
        },
        cell: ({ row }) => {
          const status = row.original.consent_status;

          if (status === "signed") {
            return (
              <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20" variant="outline">
                Firmado
              </Badge>
            );
          }

          // pending_minor
          return (
            <div className="flex items-center gap-1">
              <Badge className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20" variant="outline">
                Pendiente padre
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={sendingConsentIds.has(row.original.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResendConsent(row.original);
                    }}
                  >
                    {sendingConsentIds.has(row.original.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Mail className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reenviar email de consentimiento al padre/tutor</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
      {
        accessorKey: "chapter",
        header: "Chapter",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          return filterValues.includes(row.original.chapter || "");
        },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.chapter || "-"}</span>
        ),
      },
      {
        accessorKey: "hub_name",
        header: "Hub",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          return filterValues.includes(row.original.hub_name || "");
        },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.hub_name || "-"}</span>
        ),
      },
      {
        accessorKey: "registration_status",
        header: "Estado",
        filterFn: (row, _id, filterValues: string[]) => {
          if (!filterValues?.length) return true;
          return filterValues.includes(row.original.registration_status || "");
        },
        cell: ({ row }) => (
          <RegistrationStatusBadge status={row.original.registration_status || "confirmed"} />
        ),
      },
      {
        accessorKey: "checked_in_at",
        header: "Check-in",
        cell: ({ row }) => {
          const checkedIn = row.original.checked_in_at;
          if (!checkedIn) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <span className="text-sm">
              {format(new Date(checkedIn), "HH:mm", { locale: es })}
            </span>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Fecha registro",
        cell: ({ row }) => {
          const date = row.original.created_at;
          if (!date) return "-";
          return (
            <span className="text-sm text-muted-foreground">
              {format(new Date(date), "dd/MM/yy", { locale: es })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if (row.original.registration_status === "cancelled") return null;
          return (
            <div className="flex items-center gap-2">
              {row.original.registration_status === "confirmed" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Reenviar email de entrada"
                      disabled={resendingEntryIds.has(row.original.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRegistrationToResend(row.original);
                      }}
                    >
                      {resendingEntryIds.has(row.original.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reenviar email de entrada</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Cancelar inscripción"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRegistrationToCancel(row.original);
                    }}
                  >
                    <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancelar inscripción</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendingConsentIds, resendingEntryIds]
  );

  // Waitlist data: filtered and sorted FIFO
  const waitlistRegistrations = useMemo(() => {
    return (registrations || [])
      .filter((r) => r.registration_status === "waitlisted")
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      });
  }, [registrations]);

  // Waitlist table columns
  const waitlistColumns: ColumnDef<RegistrationWithCompanions>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Nombre",
        accessorFn: (row) =>
          `${row.first_name || ""} ${row.last_name || ""} ${row.email || ""}`.trim().toLowerCase(),
        cell: ({ row }) => {
          const name = `${row.original.first_name || ""} ${row.original.last_name || ""}`.trim();
          return (
            <div>
              <p className="font-medium">{name || "-"}</p>
              <p className="text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "ticket_type_name",
        header: "Tipo Entrada",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.ticket_type?.name || "-"}</span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Fecha registro",
        cell: ({ row }) => {
          const date = row.original.created_at;
          if (!date) return "-";
          return (
            <span className="text-sm text-muted-foreground">
              {format(new Date(date), "dd/MM/yy HH:mm", { locale: es })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="text-primary border-primary/30 hover:bg-primary/10"
            disabled={promotingIds.has(row.original.id) || promoteMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              handlePromoteClick(row.original);
            }}
          >
            {promotingIds.has(row.original.id) ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <UserPlus className="h-4 w-4 mr-1" />
            )}
            Invitar
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [promotingIds, promoteMutation.isPending]
  );

  // Export CSV
  const handleExport = (exportData: ExportData<RegistrationWithCompanions>) => {
    const rows = exportData.rows;
    if (rows.length === 0) return;

    const csvRows: Record<string, string | number>[] = [];

    rows.forEach((r) => {
      csvRows.push({
        Nombre: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        Email: r.email || "",
        DNI: r.dni || "",
        Teléfono: r.phone || "",
        Equipo: r.team_name || "",
        "Tipo Entrada": r.ticket_type?.name || "",
        Acompañantes: r.companions_count,
        Consentimiento: r.has_consent ? "Sí" : "No",
        Estado: r.registration_status || "",
        Chapter: r.chapter || "",
        Hub: r.hub_name || "",
        "Check-in": r.checked_in_at
          ? format(new Date(r.checked_in_at), "dd/MM/yyyy HH:mm")
          : "No",
        "Fecha registro": r.created_at
          ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm")
          : "",
      });

      r.companions_details.forEach((comp) => {
        csvRows.push({
          Nombre: `  ↳ ${comp.first_name || ""} ${comp.last_name || ""}`.trim(),
          Email: "",
          DNI: comp.dni || "",
          Teléfono: "",
          Equipo: r.team_name || "",
          "Tipo Entrada": `Acompañante (${comp.relationship || ""})`,
          Acompañantes: "",
          Consentimiento: "",
          Estado: "",
          Chapter: "",
          Hub: "",
          "Check-in": comp.checked_in_at
            ? format(new Date(comp.checked_in_at), "dd/MM/yyyy HH:mm")
            : "No",
          "Fecha registro": "",
        });
      });
    });

    const headers = Object.keys(csvRows[0]);
    const csvContent =
      "\uFEFF" +
      headers.join(";") +
      "\n" +
      csvRows.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(";")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inscripciones-evento-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Total Attendees Summary */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-full">
              <UsersRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-primary">{metrics.totalAttendees}</h3>
              <p className="text-sm text-muted-foreground">Total asistentes confirmados</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{metrics.mainRegistrations}</span> registros
              {metrics.companionsCount > 0 && (
                <>
                  {" + "}
                  <span className="font-medium text-foreground">{metrics.companionsCount}</span> acompañantes
                </>
              )}
            </p>
            {event?.max_capacity && (
              <p className="text-muted-foreground mt-1">
                Capacidad: {metrics.totalAttendees} / {event.max_capacity}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Warning: participants in inactive/previous-season teams */}
      {inactiveTeamMembers && inactiveTeamMembers.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Participantes en equipos de ediciones anteriores</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              {inactiveTeamMembers.length} persona(s) registrada(s) en este evento pertenecen a equipos inactivos o de ediciones anteriores:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-sm">
              {inactiveTeamMembers.map((m) => (
                <li key={m.userId}>
                  <span className="font-medium">{m.name}</span> ({m.email}) — Equipo: {m.teamName}
                  {m.season && ` (Season ${m.season})`}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Participantes"
          value={metrics.participantsCount}
          icon={<Users />}
          color="primary"
        />
        <MetricCard
          title="Acompañantes"
          value={metrics.companionsCount}
          icon={<UserPlus />}
          color="info"
        />
        <MetricCard
          title="Mentores / Jueces"
          value={metrics.mentorsCount}
          icon={<GraduationCap />}
          color="success"
        />
        <MetricCard
          title="Equipos"
          value={teamStats?.length || 0}
          icon={<Users2 />}
          color="accent"
        />
        <MetricCard
          title="Consentimientos"
          value={`${metrics.consentsSigned} / ${metrics.consentsTotal}`}
          icon={<FileCheck />}
          color={metrics.consentsSigned === metrics.consentsTotal ? "success" : "warning"}
        />
        <MetricCard
          title="Entradas restantes"
          value={event?.max_capacity ? metrics.remainingTickets : "∞"}
          icon={<Ticket />}
          color={metrics.remainingTickets < 20 ? "warning" : "accent"}
        />
        <MetricCard
          title="Lista de espera"
          value={metrics.waitlistedCount}
          icon={<Clock />}
          color={metrics.waitlistedCount > 0 ? "warning" : "accent"}
        />
      </div>

      {/* Accreditation Live Dashboard Button (admin only) */}
      {role === "admin" && (
        <div className="flex">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => navigate(`/admin/events/${eventId}/accreditations`)}
          >
            <ScanLine className="h-4 w-4" />
            Acreditaciones en Vivo
          </Button>
        </div>
      )}

      {/* Tabs: Equipos / Usuarios / Lista de espera */}
      <Tabs defaultValue="equipos">
        <TabsList>
          <TabsTrigger value="equipos">Equipos</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          {metrics.waitlistedCount > 0 && (
            <TabsTrigger value="lista-espera">
              Lista de espera ({metrics.waitlistedCount})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="equipos" className="mt-4">
          <TeamRegistrationSummary
            teams={teamStats || []}
            isLoading={teamStatsLoading}
            onToggleValidated={(teamId, validated) =>
              toggleValidatedMutation.mutate({ teamId, validated })
            }
          />
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4">
          <h3 className="text-lg font-semibold mb-4">Listado de Inscripciones</h3>
          <div className="mb-4">
            <Button
              variant="outline"
              disabled={bulkEntrySending || confirmedRegistrations.length === 0}
              onClick={() => setShowBulkEntryConfirm(true)}
            >
              {bulkEntrySending && bulkEntryProgress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reenviando {bulkEntryProgress.sent + bulkEntryProgress.failed} de {bulkEntryProgress.total}...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Reenviar entradas a todos ({confirmedRegistrations.length})
                </>
              )}
            </Button>
          </div>
          {isPendingMinorFilterActive && pendingMinorRegistrations.length > 0 && (
            <div className="mb-4">
              <Button
                variant="outline"
                className="border-warning text-warning hover:bg-warning/10"
                disabled={bulkConsentSending || pendingMinorRegistrations.length === 0}
                onClick={() => setShowBulkConsentConfirm(true)}
              >
                {bulkConsentSending && bulkConsentProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando {bulkConsentProgress.sent + bulkConsentProgress.failed} de {bulkConsentProgress.total}...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar correo a todos los pendientes ({pendingMinorRegistrations.length})
                  </>
                )}
              </Button>
            </div>
          )}
          <AirtableDataTable
            columns={columns}
            data={displayedRegistrations}
            loading={isLoading}
            searchPlaceholder="Buscar por nombre o email..."
            filterableColumns={filterableColumns}
            hiddenColumns={hiddenColumns}
            onExport={handleExport}
            onActiveFiltersChange={setActiveFilters}
            filterBarContent={
              <div className="flex items-center gap-2">
                <Switch
                  id="show-cancelled"
                  checked={showCancelled}
                  onCheckedChange={setShowCancelled}
                />
                <Label htmlFor="show-cancelled" className="text-sm font-medium cursor-pointer">
                  Mostrar canceladas
                </Label>
              </div>
            }
          />
        </TabsContent>

        {metrics.waitlistedCount > 0 && (
          <TabsContent value="lista-espera" className="mt-4">
            <h3 className="text-lg font-semibold mb-4">Lista de Espera</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ordenado por fecha de registro (primera persona en apuntarse primero). Pulsa "Invitar" para confirmar la inscripción y enviar el email con la entrada.
            </p>
            <AirtableDataTable
              columns={waitlistColumns}
              data={waitlistRegistrations}
              loading={isLoading}
              searchPlaceholder="Buscar en lista de espera..."
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!registrationToCancel}
        onOpenChange={(open) => !open && setRegistrationToCancel(null)}
        title="¿Cancelar esta inscripción?"
        description={
          registrationToCancel
            ? `Se cancelará la inscripción de ${registrationToCancel.first_name || ""} ${registrationToCancel.last_name || ""}${registrationToCancel.companions_count > 0 ? ` y sus ${registrationToCancel.companions_count} acompañante(s)` : ""}. Esta acción liberará las plazas correspondientes.`
            : ""
        }
        confirmText="Cancelar inscripción"
        variant="danger"
        loading={cancelMutation.isPending}
        onConfirm={async () => {
          if (!registrationToCancel) return;
          await cancelMutation.mutateAsync({
            registrationId: registrationToCancel.id,
            eventId: eventId,
            ticketTypeId: registrationToCancel.ticket_type?.id || "",
            companionsCount: registrationToCancel.companions_count,
            registrationStatus: registrationToCancel.registration_status || "confirmed",
          });
          setRegistrationToCancel(null);
        }}
      />

      {/* Resend Entry Email Confirmation Dialog */}
      <ConfirmDialog
        open={!!registrationToResend}
        onOpenChange={(open) => !open && setRegistrationToResend(null)}
        title="¿Reenviar email de entrada?"
        description={
          registrationToResend
            ? `Se reenviará el email de confirmación con la entrada y código QR a ${registrationToResend.first_name || ""} ${registrationToResend.last_name || ""} (${registrationToResend.email || "sin email"})${registrationToResend.companions_count > 0 ? `. Incluye ${registrationToResend.companions_count} acompañante(s).` : "."}`.trim()
            : ""
        }
        confirmText="Reenviar entrada"
        variant="info"
        loading={resendingEntryIds.has(registrationToResend?.id || "")}
        onConfirm={async () => {
          if (!registrationToResend) return;
          await handleResendEntry(registrationToResend);
          setRegistrationToResend(null);
        }}
      />

      {/* Promote from Waitlist Confirmation Dialog (capacity warning) */}
      <ConfirmDialog
        open={!!registrationToPromote}
        onOpenChange={(open) => {
          if (!open) {
            setRegistrationToPromote(null);
            setPromoteCapacityWarning(null);
          }
        }}
        title="⚠️ Se superará el aforo máximo"
        description={
          registrationToPromote && promoteCapacityWarning
            ? `Al confirmar la inscripción de ${registrationToPromote.first_name || ""} ${registrationToPromote.last_name || ""}, el tipo de entrada "${registrationToPromote.ticket_type?.name || ""}" pasará a ${promoteCapacityWarning.currentCount + 1}/${promoteCapacityWarning.maxCapacity} plazas ocupadas. ¿Deseas continuar?`
            : ""
        }
        confirmText="Confirmar inscripción"
        variant="danger"
        loading={promoteMutation.isPending}
        onConfirm={handleConfirmPromote}
      />

      {/* Bulk Consent Email Dialog */}
      <ConfirmDialog
        open={showBulkConsentConfirm}
        onOpenChange={setShowBulkConsentConfirm}
        title="¿Enviar email de consentimiento a todos los pendientes?"
        description={`Se enviarán ${pendingMinorRegistrations.length} email${pendingMinorRegistrations.length !== 1 ? "s" : ""} de consentimiento a los padres/tutores de los menores pendientes. Esta acción puede tardar unos segundos.`}
        confirmText="Enviar a todos"
        variant="warning"
        loading={bulkConsentSending}
        onConfirm={handleBulkConsentSend}
      />

      {/* Bulk Resend Entry Email Dialog */}
      <ConfirmDialog
        open={showBulkEntryConfirm}
        onOpenChange={(open) => { if (!bulkEntrySending) setShowBulkEntryConfirm(open); }}
        title="¿Reenviar email de entrada a todos los confirmados?"
        description={`Se reenviarán ${confirmedRegistrations.length} email${confirmedRegistrations.length !== 1 ? "s" : ""} de confirmación con entrada y código QR a todos los registros confirmados. Esta acción puede tardar unos segundos.`}
        confirmText="Reenviar a todos"
        variant="warning"
        loading={bulkEntrySending}
        onConfirm={handleBulkEntrySend}
      />
    </div>
  );
}
