import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  console.log("Received auth email hook request");

  // Validate authorization token
  const authHeader = req.headers.get("authorization");
  const expectedToken = `Bearer ${hookSecret}`;
  
  if (!authHeader || authHeader !== expectedToken) {
    console.error("Unauthorized: Invalid or missing authorization token");
    return new Response(
      JSON.stringify({ error: { message: "Unauthorized" } }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const body = await req.json();
    const { user, email_data } = body as {
      user: { email: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    const { token, token_hash, redirect_to, email_action_type } = email_data;

    console.log(`Sending ${email_action_type} email to ${user.email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

    // Determine email subject based on action type
    let subject = "Verifica tu cuenta - Technovation Spain";
    let headingText = "¡Bienvenido a Technovation Spain!";
    let introText = "Estás a un paso de unirte a nuestra comunidad.";
    let buttonText = "Verificar mi cuenta";

    if (email_action_type === "magiclink") {
      subject = "Inicia sesión - Technovation Spain";
      headingText = "¡Hola de nuevo!";
      introText = "Has solicitado iniciar sesión en tu cuenta.";
      buttonText = "Iniciar sesión";
    } else if (email_action_type === "recovery") {
      subject = "Recupera tu cuenta - Technovation Spain";
      headingText = "Recuperación de cuenta";
      introText = "Has solicitado recuperar el acceso a tu cuenta.";
      buttonText = "Recuperar cuenta";
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #00A5CF 0%, #25A18E 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                🚀 Technovation Spain
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 600;">
                ${headingText}
              </h2>
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px; line-height: 1.6;">
                ${introText}
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="${magicLinkUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #00A5CF 0%, #25A18E 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 165, 207, 0.4);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
              
              <!-- Code section -->
              <p style="margin: 0 0 12px; color: #71717a; font-size: 14px;">
                O copia y pega este código de verificación:
              </p>
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <code style="font-size: 24px; font-weight: 600; color: #18181b; letter-spacing: 4px;">
                  ${token}
                </code>
              </div>
              
              <!-- Warning -->
              <p style="margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.5;">
                Si no has solicitado este email, puedes ignorarlo de forma segura. Este enlace expirará en 24 horas.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 20px; text-align: center;">
              <p style="margin: 0 0 8px; color: #71717a; font-size: 14px;">
                Technovation Spain - Inspiring Girls to Change the World
              </p>
              <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                © ${new Date().getFullYear()} Technovation Spain. Todos los derechos reservados.
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

    const { error } = await resend.emails.send({
      from: "Technovation Spain <onboarding@resend.dev>",
      to: [user.email],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("Error sending email:", error);
      throw error;
    }

    console.log(`Email sent successfully to ${user.email}`);

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-auth-email function:", error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code || 500,
          message: error.message,
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
