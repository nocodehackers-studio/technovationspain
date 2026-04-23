import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { shouldTriggerJudgeDropout } from "@/lib/judge-dropout-guard";

interface CancelRegistrationParams {
  registrationId: string;
  eventId: string;
  ticketTypeId: string;
  companionsCount: number;
  registrationStatus: string;
}

export function useAdminCancelRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      registrationId,
      eventId,
      ticketTypeId,
      companionsCount,
      registrationStatus,
    }: CancelRegistrationParams) => {
      // 0. Look up the registration owner + status so we can (a) refuse to
      // re-cancel an already-cancelled entry (prevents duplicate RPC + support
      // emails on double-click), and (b) decide whether the judge dropout flow
      // should fire. Admin may be cancelling on behalf of any user.
      const { data: registrationOwner, error: ownerError } = await supabase
        .from("event_registrations")
        .select("user_id, registration_status")
        .eq("id", registrationId)
        .single();

      if (ownerError || !registrationOwner) {
        console.error("Error fetching registration owner:", ownerError);
        throw new Error("No se encontró la inscripción");
      }

      if (registrationOwner.registration_status === "cancelled") {
        throw new Error("Esta inscripción ya está cancelada");
      }

      // 1. Delete companions first
      const { error: companionsError } = await supabase
        .from("companions")
        .delete()
        .eq("event_registration_id", registrationId);

      if (companionsError) {
        console.error("Error deleting companions:", companionsError);
        throw new Error("Error al eliminar acompañantes");
      }

      // 2. Update registration status to cancelled
      const { error: updateError } = await supabase
        .from("event_registrations")
        .update({ registration_status: "cancelled" })
        .eq("id", registrationId);

      if (updateError) {
        console.error("Error updating registration:", updateError);
        throw new Error("Error al cancelar la inscripción");
      }

      // 2b. If the registration owner is a judge, drop them from the event schedule.
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("is_judge")
        .eq("id", registrationOwner.user_id)
        .single();

      if (profileError) {
        console.error("Error fetching profile for judge dropout check:", profileError);
      }

      const isJudgeRegistration = shouldTriggerJudgeDropout(profileData);

      if (isJudgeRegistration) {
        const { error: dropErr } = await supabase.rpc("drop_judge_on_entry_cancel", {
          p_registration_id: registrationId,
        });
        if (dropErr) {
          console.error("Error marcando baja de juez en escaleta:", dropErr);
        }
      }

      // 3. Decrement counters (only if not waitlisted)
      if (registrationStatus !== "waitlisted") {
        const { error: rpcError } = await supabase.rpc("decrement_registration_count", {
          p_event_id: eventId,
          p_ticket_type_id: ticketTypeId,
          p_companions_count: companionsCount,
        });

        if (rpcError) {
          console.error("Error decrementing count:", rpcError);
          // Don't throw here - the main cancellation succeeded
        }
      }

      // 4. Send cancellation email (fire and forget)
      supabase.functions.invoke("send-cancellation-email", {
        body: { registrationId },
      }).catch((err) => console.error("Cancellation email error:", err));

      // 4b. Notify support if this was a judge (fire and forget).
      if (isJudgeRegistration) {
        supabase.functions.invoke("send-judge-dropout-notification", {
          body: { registrationId },
        }).catch((err) => console.error("Support notification email error:", err));
      }

      return { success: true, isJudgeRegistration };
    },
    onSuccess: (result, variables) => {
      toast.success("Inscripción cancelada correctamente");

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["event-registrations-stats", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-stats", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-companions-count", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-team-stats", variables.eventId] });

      if (result.isJudgeRegistration) {
        queryClient.invalidateQueries({ queryKey: ["judging-assignments", variables.eventId] });
        queryClient.invalidateQueries({ queryKey: ["event-judges", variables.eventId] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al cancelar la inscripción");
    },
  });
}
