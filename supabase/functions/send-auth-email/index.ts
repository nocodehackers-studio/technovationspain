import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") as string;
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation Girls Madrid";
const BREVO_REPLY_TO_EMAIL = Deno.env.get("BREVO_REPLY_TO_EMAIL") || "soporte@powertocode.org";
let hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

// Logo URLs from Supabase Storage
const LOGO_TECHNOVATION = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/LOGO_Technovation_Girls_Transparente.png";
const LOGO_POWER_TO_CODE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode.png";

// Supabase provides: "v1,whsec_<base64>". standardwebhooks expects ONLY the base64 part.
if (hookSecret?.startsWith("v1,whsec_")) {
  hookSecret = hookSecret.replace("v1,whsec_", "");
} else if (hookSecret?.startsWith("whsec_")) {
  hookSecret = hookSecret.replace("whsec_", "");
} else if (hookSecret?.startsWith("v1,")) {
  hookSecret = hookSecret.substring(3);
}

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

// Get email content based on action type
function getEmailContent(emailActionType: string): {
  subject: string;
  headingText: string;
  introText: string;
  buttonText: string;
} {
  switch (emailActionType) {
    case "signup":
      return {
        subject: "Verifica tu cuenta - Technovation Girls Madrid",
        headingText: "¡Bienvenido/a a Technovation Girls Madrid!",
        introText: "Estás a un paso de unirte a nuestra comunidad.",
        buttonText: "Verificar mi cuenta",
      };
    case "invite":
      return {
        subject: "Te han invitado - Plataforma Power To Code",
        headingText: "¡Has recibido una invitación!",
        introText: "Un administrador te ha invitado a unirte a la plataforma de Technovation Girls Madrid.",
        buttonText: "Aceptar invitación",
      };
    case "magiclink":
      return {
        subject: "Inicia sesión - Plataforma Power To Code",
        headingText: "¡Hola de nuevo!",
        introText: "Haz clic en el botón para acceder a tu cuenta.",
        buttonText: "Iniciar sesión",
      };
    case "recovery":
      return {
        subject: "Recupera tu cuenta - Technovation Girls Madrid",
        headingText: "Recuperación de cuenta",
        introText: "Has solicitado restablecer tu acceso a la plataforma.",
        buttonText: "Recuperar cuenta",
      };
    default:
      return {
        subject: "Verifica tu cuenta - Technovation Girls Madrid",
        headingText: "¡Bienvenido/a a Technovation Girls Madrid!",
        introText: "Estás a un paso de unirte a nuestra comunidad.",
        buttonText: "Verificar mi cuenta",
      };
  }
}

// Generate email HTML template
function generateEmailHtml(
  magicLinkUrl: string,
  token: string,
  content: { subject: string; headingText: string; introText: string; buttonText: string }
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header with Logos -->
          <tr>
            <td style="background: linear-gradient(135deg, #00A5CF 0%, #25A18E 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <img src="${LOGO_TECHNOVATION}" alt="Technovation Girls" style="height: 50px; margin-right: 20px; display: inline-block; vertical-align: middle; mix-blend-mode: multiply;">
                    <img src="${LOGO_POWER_TO_CODE}" alt="Power To Code" style="height: 45px; display: inline-block; vertical-align: middle;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 600;">
                ${content.headingText}
              </h2>
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px; line-height: 1.6;">
                ${content.introText}
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="${magicLinkUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #00A5CF 0%, #25A18E 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 165, 207, 0.4);">
                      ${content.buttonText}
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

// Background task to send email via Brevo - runs after response is sent
async function sendEmailInBackground(
  email: string,
  subject: string,
  html: string
): Promise<void> {
  try {
    const emailPayload = {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      replyTo: { email: BREVO_REPLY_TO_EMAIL },
      to: [{ email: email }],
      subject: subject,
      htmlContent: html,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo email error:", errorData);
    } else {
      console.log(`Email sent successfully to ${email}`);
    }
  } catch (err: any) {
    console.error("Background email exception:", err.message);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  console.log("Received auth email hook request");
  
  // Log header keys for debugging (not values for security)
  const headerKeys = Array.from(req.headers.keys());
  console.log("Request header keys:", headerKeys.join(", "));

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  try {
    // Verify webhook signature
    const wh = new Webhook(hookSecret);
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    console.log(`Queueing ${email_action_type} email to ${user.email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

    // Get email content based on action type
    const content = getEmailContent(email_action_type);
    
    // Generate HTML with the appropriate content
    const html = generateEmailHtml(magicLinkUrl, token, content);

    // Send email in background using EdgeRuntime.waitUntil
    // This allows us to respond immediately while email sends async
    EdgeRuntime.waitUntil(sendEmailInBackground(user.email, content.subject, html));

    console.log(`Email queued for ${user.email}, responding immediately`);

    // Return success immediately - email will be sent in background
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-auth-email function:", error.message);
    console.error("Full error:", JSON.stringify(error));
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
