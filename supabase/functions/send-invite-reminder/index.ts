import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") as string;
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation Girls Madrid";
const BREVO_REPLY_TO_EMAIL = Deno.env.get("BREVO_REPLY_TO_EMAIL") || "soporte@powertocode.org";

const LOGO_TECHNOVATION = "https://app.powertocode.org/images/Logo_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";
const PLATFORM_URL = "https://app.powertocode.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateReminderHtml(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(" ") || "participante";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Te esperamos en Technovation Girls Madrid</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header with Logos -->
          <tr>
            <td style="background: linear-gradient(135deg, #00A5CF 0%, #25A18E 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <img src="${LOGO_TECHNOVATION}" alt="Technovation Girls" style="height: 50px; margin-right: 20px; display: inline-block; vertical-align: middle;">
              <img src="${LOGO_POWER_TO_CODE}" alt="Power To Code" style="height: 45px; display: inline-block; vertical-align: middle;">
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 600;">
                ¡Te esperamos en Technovation Girls Madrid!
              </h2>
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px; line-height: 1.6;">
                Hola ${name}, vemos que aún no te has registrado en nuestra plataforma de gestión de Technovation Girls Madrid. Regístrate para poder acceder a los eventos, talleres y toda la información de la temporada.
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="${PLATFORM_URL}" 
                       style="display: inline-block; background: linear-gradient(135deg, #00A5CF 0%, #25A18E 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 165, 207, 0.4);">
                      Registrarme ahora
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Info -->
              <p style="margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.5;">
                Si ya te has registrado, puedes ignorar este email. Si tienes alguna duda, contacta con nosotros en soporte@powertocode.org.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 20px; text-align: center;">
              <p style="margin: 0 0 8px; color: #71717a; font-size: 14px;">
                Technovation Girls Madrid. Girls for a change.
              </p>
              <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                © ${new Date().getFullYear()} Power To Code. Todos los derechos reservados.
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Validate admin JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin role
    const { data: roleData } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, firstName, lastName } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const html = generateReminderHtml(firstName, lastName);
    const subject = "Te esperamos en Technovation Girls Madrid";

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        replyTo: { email: BREVO_REPLY_TO_EMAIL },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    });

    if (!brevoRes.ok) {
      const errData = await brevoRes.json();
      console.error("Brevo error:", errData);
      return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Invite reminder sent to ${email}`);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
