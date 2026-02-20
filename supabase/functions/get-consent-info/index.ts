import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "");

const ALLOWED_ORIGINS = [
  PUBLIC_SITE_URL,
  "http://localhost:5173",
  "http://localhost:8080",
].filter(Boolean) as string[];

if (!PUBLIC_SITE_URL) {
  console.warn("PUBLIC_SITE_URL is not set — CORS will reject all non-localhost origins");
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : (PUBLIC_SITE_URL || ""),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { consent_token } = await req.json();

    if (!consent_token || typeof consent_token !== "string") {
      return new Response(
        JSON.stringify({ error: "validation_error", message: "Token requerido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select(`
        id, first_name, last_name,
        event:events(name, date, location_name, location_address, location_city)
      `)
      .eq("consent_token", consent_token)
      .maybeSingle();

    if (regError || !registration) {
      return new Response(
        JSON.stringify({ error: "not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = Array.isArray(registration.event) ? registration.event[0] : registration.event;

    return new Response(
      JSON.stringify({
        participant_name: `${registration.first_name || ""} ${registration.last_name || ""}`.trim(),
        event_name: event?.name || "",
        event_date: event?.date || "",
        event_location_name: event?.location_name || "",
        event_location_address: event?.location_address || "",
        event_location_city: event?.location_city || "",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-consent-info:", error);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
