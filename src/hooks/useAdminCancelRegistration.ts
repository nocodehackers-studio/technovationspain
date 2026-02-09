import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

      return { success: true };
    },
    onSuccess: (_, variables) => {
      toast.success("Inscripción cancelada correctamente");
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["event-registrations-stats", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-stats", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-companions-count", variables.eventId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al cancelar la inscripción");
    },
  });
}
