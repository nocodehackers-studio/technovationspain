import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") as string;
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation Girls Madrid";
const BREVO_REPLY_TO_EMAIL = Deno.env.get("BREVO_REPLY_TO_EMAIL") || "soporte@powertocode.org";

const SUPPORT_NOTIFICATION_EMAIL = Deno.env.get("SUPPORT_NOTIFICATION_EMAIL") || "soporte@powertocode.org";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://app.powertocode.org";

const LOGO_TECHNOVATION = "https://app.powertocode.org/images/Logo_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatTime(time: string | null): string {
  if (!time) return "";
  return time.substring(0, 5);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Strip CR/LF to prevent header injection when user-controlled fields
// (names, event titles) end up in the email subject.
function sanitizeHeader(input: string): string {
  return input.replace(/[\r\n]+/g, " ").trim();
}

function generateSupportNotificationHtml(params: {
  judgeFullName: string;
  judgeEmail: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  registrationNumber: string;
  eventId: string;
  dropoutTimestamp: string;
}): string {
  const {
    judgeFullName, judgeEmail, eventName, eventDate, eventTime,
    eventLocation, registrationNumber, eventId, dropoutTimestamp,
  } = params;

  const scheduleUrl = `${APP_BASE_URL}/admin/events/${eventId}/judging/schedule`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Juez de baja</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:30px;border-radius:16px 16px 0 0;text-align:center;">
              <img src="${LOGO_TECHNOVATION}" alt="Technovation Girls" style="height:50px;margin-right:20px;display:inline-block;vertical-align:middle;">
              <img src="${LOGO_POWER_TO_CODE}" alt="Power To Code" style="height:45px;display:inline-block;vertical-align:middle;">
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-radius:0 0 16px 16px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:24px;font-weight:600;">
                ⚠️ Juez de baja en evento
              </h2>
              <p style="margin:0 0 24px;color:#52525b;font-size:16px;line-height:1.6;">
                El juez <strong>${escapeHtml(judgeFullName)}</strong> (${escapeHtml(judgeEmail)}) ha cancelado su entrada al evento
                <strong>${escapeHtml(eventName)}</strong>. El sistema ha marcado automáticamente su baja en la escaleta
                (<code>judge_assignments</code> y <code>judging_panel_judges</code>). Revisa el panel para reorganizar.
              </p>

              <!-- Details -->
              <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#fef2f2;border-radius:12px;padding:4px;border:1px solid #fecaca;">
                <tr><td style="padding:16px 20px;">
                  <p style="margin:0 0 8px;color:#52525b;font-size:15px;">👤 <strong>Juez:</strong> ${escapeHtml(judgeFullName)}</p>
                  <p style="margin:0 0 8px;color:#52525b;font-size:15px;">✉️ <strong>Email:</strong> ${escapeHtml(judgeEmail)}</p>
                  <p style="margin:0 0 8px;color:#52525b;font-size:15px;">📅 <strong>Evento:</strong> ${escapeHtml(eventName)}</p>
                  <p style="margin:0 0 8px;color:#52525b;font-size:15px;">📆 <strong>Fecha:</strong> ${escapeHtml(eventDate)}</p>
                  ${eventTime ? `<p style="margin:0 0 8px;color:#52525b;font-size:15px;">🕐 <strong>Horario:</strong> ${escapeHtml(eventTime)}</p>` : ""}
                  <p style="margin:0 0 8px;color:#52525b;font-size:15px;">📍 <strong>Ubicación:</strong> ${escapeHtml(eventLocation)}</p>
                  <p style="margin:0 0 8px;color:#52525b;font-size:15px;">🔢 <strong>Nº de entrada:</strong> <code style="background-color:#fff;border-radius:4px;padding:2px 8px;font-size:14px;font-weight:600;color:#18181b;">${escapeHtml(registrationNumber)}</code></p>
                  <p style="margin:0;color:#52525b;font-size:15px;">🕒 <strong>Baja registrada:</strong> ${escapeHtml(dropoutTimestamp)}</p>
                </td></tr>
              </table>

              <div style="text-align:center;margin:32px 0 8px;">
                <a href="${scheduleUrl}" style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
                  Ver escaleta del evento
                </a>
              </div>

              <p style="margin:24px 0 0;color:#52525b;font-size:14px;line-height:1.6;">
                Este mensaje se ha generado automáticamente. Si los datos no cuadran, revísalos directamente en la base de datos.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:32px 20px;text-align:center;">
              <p style="margin:0 0 8px;color:#71717a;font-size:14px;">Technovation Girls Madrid. Girls for a change.</p>
              <p style="margin:0;color:#a1a1aa;font-size:12px;">© ${new Date().getFullYear()} Power To Code. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { registrationId } = await req.json();
    if (!registrationId) {
      return new Response(JSON.stringify({ error: "registrationId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: registration, error: regError } = await supabaseAdmin
      .from("event_registrations")
      .select(`
        id, first_name, last_name, email, registration_number, user_id,
        event:events!event_registrations_event_id_fkey(id, name, date, start_time, end_time, location_name, location_address, location_city)
      `)
      .eq("id", registrationId)
      .single();

    if (regError || !registration) {
      console.error("Registration not found:", regError);
      return new Response(JSON.stringify({ error: "Registration not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Supabase may return the joined event as an object or a single-element
    // array depending on inferred cardinality — normalize both shapes.
    const rawEvent = registration.event as any;
    const event = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
    if (!event || !event.id) {
      return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency guard: only send if the registration owner is actually a judge.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_judge")
      .eq("id", registration.user_id)
      .single();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!profile?.is_judge) {
      console.log(`Skipping support notification: user ${registration.user_id} is not a judge`);
      return new Response(JSON.stringify({ success: true, skipped: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const judgeFullName = [registration.first_name, registration.last_name].filter(Boolean).join(" ").trim() || "(sin nombre)";
    const judgeEmail = registration.email || "(sin email)";
    const registrationNumber = registration.registration_number || "—";

    const locationParts = [event.location_name, event.location_address, event.location_city].filter(Boolean);
    const locationStr = locationParts.join(", ") || "Por confirmar";

    let timeStr = "";
    if (event.start_time) {
      timeStr = formatTime(event.start_time);
      if (event.end_time) {
        timeStr += ` - ${formatTime(event.end_time)}`;
      }
    }

    const html = generateSupportNotificationHtml({
      judgeFullName,
      judgeEmail,
      eventName: event.name,
      eventDate: formatDate(event.date),
      eventTime: timeStr,
      eventLocation: locationStr,
      registrationNumber,
      eventId: event.id,
      dropoutTimestamp: formatTimestamp(new Date()),
    });

    const subject = sanitizeHeader(`⚠️ Juez de baja: ${judgeFullName} - ${event.name}`);

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        replyTo: { email: BREVO_REPLY_TO_EMAIL },
        to: [{ email: SUPPORT_NOTIFICATION_EMAIL }],
        subject,
        htmlContent: html,
      }),
    });

    if (!brevoRes.ok) {
      const errData = await brevoRes.json();
      console.error("Brevo error:", errData);
      return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Judge dropout notification sent to ${SUPPORT_NOTIFICATION_EMAIL} for registration ${registrationId}`);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
