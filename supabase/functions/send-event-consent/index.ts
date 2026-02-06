import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation España";
const BREVO_REPLY_TO_EMAIL = Deno.env.get("BREVO_REPLY_TO_EMAIL") || "soporte@powertocode.org";
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://technovation.es";

// Escape HTML to prevent XSS in email templates
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EventConsentRequest {
  registrationId: string;
}

Deno.serve(async (req) => {
  console.log("send-event-consent function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate BREVO_API_KEY exists
    if (!BREVO_API_KEY) {
      console.error("BREVO_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized - no token provided" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user's JWT token
    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("Invalid authentication:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { registrationId }: EventConsentRequest = await req.json();
    console.log("Processing event consent for registration:", registrationId);

    // Create Supabase client with service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch registration with event details (select(*) includes consent_token)
    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select(`
        *,
        event:events(*)
      `)
      .eq("id", registrationId)
      .single();

    if (regError || !registration) {
      console.error("Error fetching registration:", regError);
      return new Response(
        JSON.stringify({ error: "Registration not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify ownership: user must own the registration
    if (registration.user_id !== user.id) {
      console.error("User does not own this registration");
      return new Response(
        JSON.stringify({ error: "Forbidden - not your registration" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch user profile to get parent_email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, parent_email, first_name, last_name")
      .eq("id", registration.user_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const event = registration.event;
    console.log("Event found:", event.name);

    // Determine recipient: parent_email for minors, profile.email as fallback
    const recipientEmail = profile.parent_email || profile.email;
    const isParentRecipient = !!profile.parent_email;

    if (!profile.parent_email) {
      console.warn(`COMPLIANCE_WARNING: Sending event consent to user email (no parent_email on profile) for user ${registration.user_id}`);
    }

    console.log(`Sending event consent to: ${recipientEmail} (parent: ${isParentRecipient})`);

    // Build consent URL using consent_token
    const consentUrl = `${PUBLIC_SITE_URL}/consentimiento?token=${registration.consent_token}`;

    // Format event date
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build HTML email content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                Consentimiento para evento
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                Technovation Girls España
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px; color: #374151; font-size: 16px; line-height: 1.6;">
              <p style="margin: 0 0 16px 0;">Hola,</p>

              <p style="margin: 0 0 16px 0;">
                <strong>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</strong> se ha inscrito en el evento "<strong>${escapeHtml(event.name)}</strong>".
              </p>

              <!-- Event details -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; font-weight: 600; color: #1f2937;">Detalles del evento</p>
                <table style="width: 100%; color: #4b5563;">
                  <tr>
                    <td style="padding: 4px 0;">📅 <strong>Fecha:</strong></td>
                    <td style="padding: 4px 0;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">🕐 <strong>Horario:</strong></td>
                    <td style="padding: 4px 0;">${event.start_time || ""} - ${event.end_time || ""}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">📍 <strong>Lugar:</strong></td>
                    <td style="padding: 4px 0;">${escapeHtml(event.location_name)}</td>
                  </tr>
                  ${event.location_address ? `
                  <tr>
                    <td style="padding: 4px 0;"></td>
                    <td style="padding: 4px 0; color: #6b7280;">${escapeHtml(event.location_address)}${event.location_city ? `, ${escapeHtml(event.location_city)}` : ""}</td>
                  </tr>
                  ` : ""}
                </table>
              </div>

              <p style="margin: 0 0 16px 0;">
                Para confirmar la asistencia, necesitamos tu consentimiento. Haz clic en el botón para firmar el consentimiento online.
              </p>

              <div style="text-align: center; margin: 24px 0;">
                <a href="${consentUrl}"
                   style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Firmar consentimiento
                </a>
              </div>
              <p style="text-align: center; color: #6b7280; font-size: 14px;">
                O copia este enlace: ${escapeHtml(consentUrl)}
              </p>

              <!-- Important note -->
              <table width="100%" style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <tr>
                  <td>
                    <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                      <strong>⚠️ Importante:</strong> Sin el consentimiento firmado, no se podrá acceder al evento.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0;">
                Si tienes alguna pregunta, no dudes en contactarnos respondiendo a este email.
              </p>

              <p style="margin: 24px 0 0 0; font-weight: 600; color: #7c3aed;">
                ¡Gracias!
              </p>

              <p style="margin: 16px 0 0 0; color: #6b7280;">
                Equipo de Technovation Spain
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                Power To Code - Embajadores de Technovation Girls Madrid
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                <a href="https://powertocode.org" style="color: #7c3aed; text-decoration: none;">powertocode.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email via Brevo (no PDF attachment)
    const emailPayload = {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: recipientEmail }],
      subject: `Consentimiento para ${event.name} - Technovation Spain`,
      htmlContent: htmlContent,
      replyTo: { email: BREVO_REPLY_TO_EMAIL },
    };

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY!,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Brevo API error:", errorData);

      const status = emailResponse.status === 401 ? 401 : 500;
      return new Response(
        JSON.stringify({ error: "brevo_api_error", details: errorData }),
        { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailResult = await emailResponse.json();
    console.log("Event consent email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResult.messageId,
        recipient: recipientEmail,
        isParentRecipient,
        eventName: event.name,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-event-consent function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
