import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ValidationResponse {
  valid: boolean;
  error?: 'not_found' | 'already_checked_in' | 'wrong_date' | 'cancelled';
  registration?: {
    id: string;
    display_name: string;
    ticket_type: string;
    event_name: string;
    team_name?: string;
    is_companion?: boolean;
  };
}

// Get today's date in Madrid timezone
function getTodayInMadrid(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date()); // Returns YYYY-MM-DD format
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Client with user token to verify identity
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseUser.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userId = claimsData.claims.sub as string;

    // 2. Verify role (volunteer or admin) using admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      console.error("Roles error:", rolesError);
      return new Response(JSON.stringify({ error: "Failed to verify roles" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userRoles = roles?.map(r => r.role) || [];
    if (!userRoles.includes("volunteer") && !userRoles.includes("admin")) {
      console.log("Unauthorized role for user:", userId, "roles:", userRoles);
      return new Response(JSON.stringify({ error: "Unauthorized role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Get QR code from body
    const body = await req.json();
    const qr_code = body.qr_code;
    
    if (!qr_code) {
      return new Response(JSON.stringify({ valid: false, error: "not_found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Validating QR code:", qr_code);

    // 4. Search in event_registrations first (using admin client - no RLS)
    const { data: registration, error: regError } = await supabaseAdmin
      .from("event_registrations")
      .select(`
        id, qr_code, first_name, last_name, team_name,
        checked_in_at, registration_status,
        event:events(id, name, date),
        ticket_type:event_ticket_types(name)
      `)
      .eq("qr_code", qr_code)
      .maybeSingle();

    if (regError) {
      console.error("Registration lookup error:", regError);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. If not found in registrations, search in companions
    let isCompanion = false;
    let companionData = null;
    
    if (!registration) {
      const { data: companion, error: compError } = await supabaseAdmin
        .from("companions")
        .select(`
          id, qr_code, first_name, last_name, relationship,
          checked_in_at,
          event_registration:event_registrations(
            registration_status,
            event:events(id, name, date)
          )
        `)
        .eq("qr_code", qr_code)
        .maybeSingle();

      if (compError) {
        console.error("Companion lookup error:", compError);
      }

      if (companion) {
        isCompanion = true;
        companionData = companion;
      }
    }

    // 6. Handle not found
    if (!registration && !companionData) {
      console.log("QR code not found:", qr_code);
      return new Response(JSON.stringify({ valid: false, error: "not_found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 7. Validate based on type (registration or companion)
    const todayMadrid = getTodayInMadrid();

    if (isCompanion && companionData) {
      // Companion validation
      const eventReg = companionData.event_registration as any;
      
      if (eventReg?.registration_status === "cancelled") {
        return new Response(JSON.stringify({ valid: false, error: "cancelled" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (companionData.checked_in_at) {
        return new Response(JSON.stringify({ valid: false, error: "already_checked_in" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const eventDate = eventReg?.event?.date;
      if (eventDate && eventDate !== todayMadrid) {
        console.log("Wrong date for companion. Event:", eventDate, "Today:", todayMadrid);
        return new Response(JSON.stringify({ valid: false, error: "wrong_date" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Perform check-in for companion
      const { error: updateError } = await supabaseAdmin
        .from("companions")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", companionData.id);

      if (updateError) {
        console.error("Companion check-in error:", updateError);
        return new Response(JSON.stringify({ error: "Check-in failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Log the check-in
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "check_in_companion",
        entity_type: "companion",
        entity_id: companionData.id,
        changes: { checked_in_at: new Date().toISOString() }
      });

      const response: ValidationResponse = {
        valid: true,
        registration: {
          id: companionData.id,
          display_name: [companionData.first_name, companionData.last_name]
            .filter(Boolean).join(" ") || "Acompañante",
          ticket_type: companionData.relationship || "Acompañante",
          event_name: eventReg?.event?.name || "Evento",
          is_companion: true
        }
      };

      console.log("Companion check-in successful:", companionData.id);
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Main registration validation (registration is guaranteed non-null here)
    const reg = registration!;
    
    if (reg.registration_status === "cancelled") {
      return new Response(JSON.stringify({ valid: false, error: "cancelled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (reg.checked_in_at || reg.registration_status === "checked_in") {
      return new Response(JSON.stringify({ valid: false, error: "already_checked_in" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check event date - handle both single object and array from join
    const eventData = reg.event;
    const event = Array.isArray(eventData) ? eventData[0] : eventData;
    const eventDate = event?.date;
    if (eventDate && eventDate !== todayMadrid) {
      console.log("Wrong date. Event:", eventDate, "Today:", todayMadrid);
      return new Response(JSON.stringify({ valid: false, error: "wrong_date" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 8. Perform check-in
    const { error: updateError } = await supabaseAdmin
      .from("event_registrations")
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: userId,
        registration_status: "checked_in"
      })
      .eq("id", reg.id);

    if (updateError) {
      console.error("Check-in update error:", updateError);
      return new Response(JSON.stringify({ error: "Check-in failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Log the check-in
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "check_in",
      entity_type: "event_registration",
      entity_id: reg.id,
      changes: { checked_in_at: new Date().toISOString() }
    });

    // 9. Return minimal response (NO DNI, email, phone)
    const ticketTypeData = reg.ticket_type;
    const ticketType = Array.isArray(ticketTypeData) ? ticketTypeData[0] : ticketTypeData;
    const response: ValidationResponse = {
      valid: true,
      registration: {
        id: reg.id,
        display_name: [reg.first_name, reg.last_name]
          .filter(Boolean).join(" ") || "Asistente",
        ticket_type: ticketType?.name || "General",
        event_name: event?.name || "Evento",
        team_name: reg.team_name || undefined,
        is_companion: false
      }
    };

    console.log("Check-in successful:", reg.id);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
