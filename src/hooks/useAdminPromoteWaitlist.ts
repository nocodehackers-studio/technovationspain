import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PromoteWaitlistParams {
  registrationId: string;
  eventId: string;
  ticketTypeId: string;
}

interface CapacityCheck {
  currentCount: number;
  maxCapacity: number;
  exceedsCapacity: boolean;
}

export async function checkWaitlistCapacity(ticketTypeId: string): Promise<CapacityCheck> {
  const { data: ticketType, error } = await supabase
    .from("event_ticket_types")
    .select("max_capacity, current_count")
    .eq("id", ticketTypeId)
    .single();

  if (error || !ticketType) {
    throw new Error("Error al verificar la capacidad del tipo de entrada");
  }

  const currentCount = ticketType.current_count ?? 0;
  const maxCapacity = ticketType.max_capacity ?? 0;

  // F7 fix: max_capacity = 0 means unlimited — never exceeds
  return {
    currentCount,
    maxCapacity,
    exceedsCapacity: maxCapacity > 0 && currentCount + 1 > maxCapacity,
  };
}

export function useAdminPromoteWaitlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      registrationId,
      eventId,
      ticketTypeId,
    }: PromoteWaitlistParams) => {
      // 1. Update registration status (with guard against race conditions)
      const { data: updated, error: updateError } = await supabase
        .from("event_registrations")
        .update({ registration_status: "confirmed" })
        .eq("id", registrationId)
        .eq("registration_status", "waitlisted")
        .select("id")
        .single();

      if (updateError || !updated) {
        throw new Error("Esta inscripción ya fue procesada por otro administrador");
      }

      // 2. Increment capacity counters (+1, no companions)
      // F2 fix: throw on RPC error to avoid silent counter corruption
      const { error: rpcError } = await supabase.rpc("increment_registration_count", {
        p_event_id: eventId,
        p_ticket_type_id: ticketTypeId,
        p_companions_count: 0,
      });

      if (rpcError) {
        console.error("Error incrementing count:", rpcError);
        // Attempt to rollback the status change
        await supabase
          .from("event_registrations")
          .update({ registration_status: "waitlisted" })
          .eq("id", registrationId);
        throw new Error("Error al actualizar el aforo. La inscripción no se ha confirmado.");
      }

      // 3. Send confirmation email (fire and forget)
      // F4 fix: pass isWaitlistPromotion flag instead of hardcoded template string
      supabase.functions.invoke("send-registration-confirmation", {
        body: {
          registrationId,
          subjectOverride: "¡Se ha liberado una plaza para ti en {evento}!",
        },
      }).catch((err) => console.error("Confirmation email error:", err));

      return { success: true };
    },
    onSuccess: (_, variables) => {
      // F3 fix: toast text no longer claims email was sent
      toast.success("Inscripción confirmada. Email de confirmación en proceso de envío.");

      queryClient.invalidateQueries({ queryKey: ["event-registrations-stats", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-stats", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-companions-count", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-team-stats", variables.eventId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al promocionar la inscripción");
    },
  });
}
