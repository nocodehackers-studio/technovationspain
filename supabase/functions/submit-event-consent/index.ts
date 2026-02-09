import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://technovationspain.lovable.app",
  "https://app.powertocode.org",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// Server-side signature validation
const SIGNATURE_REGEX = /^[a-záéíóúñüà-ÿ\s]{3,200}$/i;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      consent_token,
      signer_full_name,
      signer_dni,
      signer_relationship,
      signature,
      minor_name,
      minor_age,
    } = await req.json();

    // Validate required fields
    if (!consent_token || !signer_full_name || !signer_dni || !signer_relationship) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "Faltan campos obligatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate signer_relationship
    const validRelationships = ["self", "madre", "padre", "tutor"];
    if (!validRelationships.includes(signer_relationship)) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "Relación no válida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean and validate DNI
    const cleanedDni = signer_dni?.trim().toUpperCase().replace(/[\s-]/g, "") || "";
    if (!cleanedDni) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "DNI/NIE es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const dniRegex = /^[0-9]{8}[A-Z]$/;
    const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/;
    if (!dniRegex.test(cleanedDni) && !nieRegex.test(cleanedDni)) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "Formato de DNI/NIE inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate signer_full_name (signature)
    const trimmedName = signer_full_name?.trim() || "";
    if (trimmedName.length < 3) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "El nombre debe tener al menos 3 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!trimmedName.includes(" ")) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "Introduce nombre y apellidos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!SIGNATURE_REGEX.test(trimmedName)) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "El nombre solo puede contener letras y espacios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate signature
    const trimmedSignature = signature?.trim() || "";
    if (trimmedSignature.length < 3) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "La firma debe tener al menos 3 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!trimmedSignature.includes(" ")) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "Firma: introduce nombre y apellidos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!SIGNATURE_REGEX.test(trimmedSignature)) {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "La firma solo puede contener letras y espacios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize text inputs
    const sanitizedName = trimmedName.slice(0, 200);
    const sanitizedSignature = trimmedSignature.slice(0, 200);
    const sanitizedDni = cleanedDni.slice(0, 15);
    const sanitizedMinorName = minor_name?.trim().slice(0, 200) || null;
    const sanitizedMinorAge = typeof minor_age === "number" && minor_age >= 0 && minor_age <= 17 ? minor_age : null;

    // Create service role client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up registration by consent_token
    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select(`
        id, registration_status,
        event:events(id, date)
      `)
      .eq("consent_token", consent_token)
      .maybeSingle();

    if (regError || !registration) {
      return new Response(
        JSON.stringify({ error: "not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate registration status
    if (registration.registration_status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "registration_cancelled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (registration.registration_status === "checked_in") {
      return new Response(
        JSON.stringify({ error: "already_checked_in" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate event date (reject consent for past events)
    const event = Array.isArray(registration.event) ? registration.event[0] : registration.event;
    if (event?.date) {
      const eventDate = new Date(event.date + "T23:59:59");
      if (eventDate < new Date()) {
        return new Response(
          JSON.stringify({ error: "event_already_passed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Capture IP address
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || null;

    // Insert consent (upsert: allow re-signing)
    // Status check above guards against checked_in; upsert handles idempotent re-signing
    const { error: consentError } = await supabase
      .from("event_ticket_consents")
      .upsert(
        {
          event_registration_id: registration.id,
          signer_full_name: sanitizedName,
          signer_dni: sanitizedDni,
          signer_relationship: signer_relationship,
          signature: sanitizedSignature,
          minor_name: sanitizedMinorName,
          minor_age: sanitizedMinorAge,
          signed_at: new Date().toISOString(),
          ip_address: ipAddress,
        },
        {
          onConflict: "event_registration_id",
          ignoreDuplicates: false,
        }
      );

    if (consentError) {
      console.error("Consent insert error:", consentError);
      return new Response(
        JSON.stringify({ error: "insert_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Consent submitted for registration:", registration.id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in submit-event-consent:", error);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
