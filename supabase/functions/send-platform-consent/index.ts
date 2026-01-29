import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "hola@pruebas.nocodehackers.es";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation España";
const BREVO_REPLY_TO_EMAIL = Deno.env.get("BREVO_REPLY_TO_EMAIL") || "soporte@powertocode.org";

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

interface PlatformConsentRequest {
  userId: string;
}

// TODO: Add idempotency check - track platform_consent_sent_at in profiles table
// to prevent duplicate consent emails on retry/re-call scenarios
const handler = async (req: Request): Promise<Response> => {
  console.log("send-platform-consent function called");

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

    const { userId }: PlatformConsentRequest = await req.json();
    console.log("Processing platform consent for user:", userId);

    // Verify ownership: user can only send consent for themselves
    if (userId !== user.id) {
      console.error("User cannot send consent for another user");
      return new Response(
        JSON.stringify({ error: "Forbidden - cannot send consent for another user" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile (include date_of_birth for compliance check)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, parent_email, first_name, last_name, date_of_birth")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Profile found:", profile.first_name, profile.last_name);

    // Determine recipient: if parent_email exists, use it; else use user email
    const recipientEmail = profile.parent_email || profile.email;
    const isParentRecipient = !!profile.parent_email;
    let complianceWarning = false;

    // Check if user is a minor (under 14) but missing parent_email - compliance issue
    if (profile.date_of_birth && !profile.parent_email) {
      const birthDate = new Date(profile.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 14) {
        console.warn(`COMPLIANCE_WARNING: Minor user ${userId} (age ${age}) has no parent_email - sending to user email`);
        complianceWarning = true;
      }
    }

    console.log(`Sending consent to: ${recipientEmail} (parent: ${isParentRecipient})`);

    // Fetch PDF from Supabase Storage
    const pdfPath = "consent-pdfs/platform-consent.pdf";
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from("Assets")
      .download(pdfPath);

    if (pdfError || !pdfData) {
      console.error("Error fetching consent PDF:", pdfError);
      return new Response(
        JSON.stringify({ error: "consent_pdf_unavailable", details: "Platform consent PDF not found in storage" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check PDF size (Brevo limit is 4MB)
    const pdfBuffer = await pdfData.arrayBuffer();
    if (pdfBuffer.byteLength > 4 * 1024 * 1024) {
      console.error("Consent PDF too large:", pdfBuffer.byteLength);
      return new Response(
        JSON.stringify({ error: "consent_pdf_too_large", details: "PDF exceeds 4MB limit" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Convert PDF to base64
    const pdfBase64 = btoa(
      new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

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
                Consentimiento requerido
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
                <strong>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</strong> se ha registrado en la plataforma de Technovation Spain.
              </p>

              <p style="margin: 0 0 16px 0;">
                Para que pueda participar en las actividades de Technovation Girls, necesitamos tu consentimiento como padre/madre/tutor legal.
              </p>

              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; font-weight: 600; color: #1f2937;">¿Qué necesitas hacer?</p>
                <ol style="margin: 0; padding-left: 20px; color: #4b5563;">
                  <li style="margin-bottom: 8px;">Descarga el documento de consentimiento adjunto (PDF)</li>
                  <li style="margin-bottom: 8px;">Léelo detenidamente</li>
                  <li style="margin-bottom: 8px;">Fírmalo</li>
                  <li style="margin-bottom: 0;">Responde a este email adjuntando el documento firmado</li>
                </ol>
              </div>

              <p style="margin: 0 0 16px 0;">
                Si tienes alguna pregunta, no dudes en contactarnos respondiendo a este email.
              </p>

              <p style="margin: 24px 0 0 0; font-weight: 600; color: #7c3aed;">
                ¡Gracias por apoyar la participación en Technovation Girls!
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

    // Send email via Brevo
    const emailPayload = {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: recipientEmail }],
      subject: "Consentimiento requerido - Technovation Spain",
      htmlContent: htmlContent,
      replyTo: { email: BREVO_REPLY_TO_EMAIL },
      attachment: [
        {
          content: pdfBase64,
          name: "consentimiento-plataforma.pdf",
        },
      ],
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

      // Determine appropriate status code
      const status = emailResponse.status === 401 ? 401 : 500;
      return new Response(
        JSON.stringify({ error: "brevo_api_error", details: errorData }),
        { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailResult = await emailResponse.json();
    console.log("Platform consent email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResult.messageId,
        recipient: recipientEmail,
        isParentRecipient,
        compliance_warning: complianceWarning,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-platform-consent function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
