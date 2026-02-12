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

function generateWelcomeHtml(firstName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenida a Technovation Girls Madrid!</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#00A5CF 0%,#25A18E 100%);padding:30px;border-radius:16px 16px 0 0;text-align:center;">
              <img src="${LOGO_TECHNOVATION}" alt="Technovation Girls" style="height:50px;margin-right:20px;display:inline-block;vertical-align:middle;">
              <img src="${LOGO_POWER_TO_CODE}" alt="Power To Code" style="height:45px;display:inline-block;vertical-align:middle;">
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-radius:0 0 16px 16px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:24px;font-weight:600;">
                ¡Hola ${firstName}!
              </h2>
              <p style="margin:0 0 16px;color:#52525b;font-size:16px;line-height:1.6;">
                ¡Nos hace mucha ilusión darte la bienvenida a Technovation Girls Madrid!
              </p>
              <p style="margin:0 0 16px;color:#52525b;font-size:16px;line-height:1.6;">
                Has dado el primer paso para formar parte de una comunidad increíble de chicas, mentores, jueces y voluntarios apasionados por la tecnología, la innovación y el emprendimiento.
              </p>
              <p style="margin:0 0 16px;color:#52525b;font-size:16px;line-height:1.6;">
                Aquí encontrarás inspiración, aprendizaje y la oportunidad de desarrollar tus ideas y proyectos con apoyo y acompañamiento en cada paso del camino.
              </p>
              <p style="margin:0 0 24px;color:#52525b;font-size:16px;line-height:1.6;">
                En nuestra plataforma encontrarás eventos, talleres y oportunidades en un entorno de colaboración.
              </p>

              <!-- Button -->
              <table role="presentation" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${PLATFORM_URL}"
                       style="display:inline-block;background:linear-gradient(135deg,#00A5CF 0%,#25A18E 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:12px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(0,165,207,0.4);">
                      Acceder a la plataforma
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#52525b;font-size:16px;line-height:1.6;">
                ¡Bienvenida a Technovation Girls Madrid!
              </p>
              <p style="margin:16px 0 0;color:#52525b;font-size:15px;line-height:1.6;">
                El equipo de <strong>Technovation Girls Madrid</strong>
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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, firstName } = await req.json();
    const recipientEmail = email || user.email;
    const name = firstName || "participante";

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "No email provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const html = generateWelcomeHtml(name);

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        replyTo: { email: BREVO_REPLY_TO_EMAIL },
        to: [{ email: recipientEmail }],
        subject: "¡Bienvenida a Technovation Girls Madrid!",
        htmlContent: html,
      }),
    });

    if (!brevoRes.ok) {
      const errData = await brevoRes.json();
      console.error("Brevo error:", errData);
      return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Welcome email sent to ${recipientEmail}`);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
