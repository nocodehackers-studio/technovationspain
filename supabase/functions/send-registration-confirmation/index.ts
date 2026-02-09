import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation España";
const BREVO_REPLY_TO_EMAIL = Deno.env.get("BREVO_REPLY_TO_EMAIL") || "soporte@powertocode.org";

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

interface RegistrationEmailRequest {
  registrationId: string;
}

// Default template content
const DEFAULT_CONFIRMATION_SUBJECT = "¡Tu inscripción a {evento} está confirmada!";
const DEFAULT_CONFIRMATION_BODY = `Hola {nombre},

¡Tu inscripción al evento "{evento}" ha sido confirmada!

📅 Fecha: {fecha}
🕐 Horario: {hora}
📍 Lugar: {ubicacion}
   {direccion}, {ciudad}

Tu número de registro es: {numero_registro}

Consulta toda la información del evento aquí: {enlace_evento}

A continuación encontrarás tu entrada con el código QR que deberás presentar en la entrada del evento.

También puedes acceder a tu entrada en cualquier momento desde: {enlace_entrada}

¡Te esperamos!

Equipo de Technovation Girls Madrid`;

// Replace template variables
function replaceVariables(
  template: string,
  data: Record<string, string>
): string {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    result = result.split(key).join(value || "");
  });
  return result;
}

// Generate QR code as PNG using Deno-native library
async function generateQRCode(url: string): Promise<Uint8Array> {
  // qrcode() returns a QRCode object, toString() gives the base64 data URL
  const qrResult = await qrcode(url);
  const dataUrl = qrResult.toString();
  
  // Convert data URL to buffer
  const base64Data = dataUrl.split(",")[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  console.log("send-registration-confirmation function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log("Authenticated user:", user.id);

    const { registrationId }: RegistrationEmailRequest = await req.json();
    console.log("Processing registration:", registrationId);

    // Create Supabase client with service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch registration with event and ticket type details
    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select(`
        *,
        event:events(*),
        ticket_type:event_ticket_types(*)
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

    // Verify ownership: user must own the registration or be an admin
    if (registration.user_id !== user.id) {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        console.error("User does not own this registration and is not admin");
        return new Response(
          JSON.stringify({ error: "Forbidden - not your registration" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log("Registration found:", registration.registration_number);

    const event = registration.event;
    const ticketType = registration.ticket_type;

    // Fetch companions for this registration
    const { data: companions } = await supabase
      .from("companions")
      .select("*")
      .eq("event_registration_id", registrationId)
      .order("created_at");

    console.log("Found companions:", companions?.length || 0);

    // Fetch custom email template if exists
    const { data: customTemplate } = await supabase
      .from("event_email_templates")
      .select("*")
      .eq("event_id", event.id)
      .eq("template_type", "confirmation")
      .eq("is_active", true)
      .maybeSingle();

    // Use custom or default template
    const subjectTemplate = customTemplate?.subject || DEFAULT_CONFIRMATION_SUBJECT;
    const bodyTemplate = customTemplate?.body_content || DEFAULT_CONFIRMATION_BODY;
    const replyToEmail = customTemplate?.reply_to_email || null;

    // Format date
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build URLs
    const ticketUrl = `https://technovationspain.lovable.app/tickets/${registration.id}`;
    const validateUrl = `https://technovationspain.lovable.app/validate/${registration.qr_code}`;

    // Format time without seconds
    const formatTime = (timeStr: string | null): string => {
      if (!timeStr) return "";
      // Remove seconds if present (HH:MM:SS -> HH:MM)
      return timeStr.split(":").slice(0, 2).join(":");
    };

    // Build event page URL
    const eventPageUrl = `https://app.powertocode.org/events/${event.id}`;

    // Prepare template variables
    const templateVars: Record<string, string> = {
      "{nombre}": registration.first_name || "",
      "{apellido}": registration.last_name || "",
      "{nombre_completo}": `${registration.first_name || ""} ${registration.last_name || ""}`.trim(),
      "{evento}": event.name || "",
      "{fecha}": formattedDate,
      "{hora}": `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`,
      "{ubicacion}": event.location_name || "",
      "{direccion}": event.location_address || "",
      "{ciudad}": event.location_city || "",
      "{numero_registro}": registration.registration_number || "",
      "{tipo_entrada}": ticketType?.name || "General",
      "{enlace_entrada}": ticketUrl,
      "{enlace_evento}": eventPageUrl,
    };

    const emailSubject = replaceVariables(subjectTemplate, templateVars);
    const emailBodyText = replaceVariables(bodyTemplate, templateVars);

    // Generate QR code and upload to storage
    console.log("Generating QR code...");
    const qrBuffer = await generateQRCode(validateUrl);
    const qrFileName = `qr-codes/${registration.qr_code}.png`;

    // Upload QR to storage
    const { error: uploadError } = await supabase.storage
      .from("Assets")
      .upload(qrFileName, qrBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading QR:", uploadError);
      // Continue without QR in storage, use data URL fallback
    }

    // Get public URL for QR
    const { data: publicUrlData } = supabase.storage
      .from("Assets")
      .getPublicUrl(qrFileName);

    const qrImageUrl = publicUrlData?.publicUrl || "";
    console.log("QR image URL:", qrImageUrl);

    // Generate and upload companion QR codes
    interface CompanionWithQR {
      first_name: string;
      last_name: string;
      relationship: string;
      qr_code: string;
      qr_image_url: string;
    }

    const companionQRs: CompanionWithQR[] = [];

    if (companions && companions.length > 0) {
      console.log("Generating companion QR codes...");
      
      for (const companion of companions) {
        const companionValidateUrl = `https://technovationspain.lovable.app/validate/${companion.qr_code}`;
        const companionQrBuffer = await generateQRCode(companionValidateUrl);
        const companionQrFileName = `qr-codes/${companion.qr_code}.png`;
        
        await supabase.storage
          .from("Assets")
          .upload(companionQrFileName, companionQrBuffer, {
            contentType: "image/png",
            upsert: true,
          });
        
        const { data: companionUrlData } = supabase.storage
          .from("Assets")
          .getPublicUrl(companionQrFileName);
        
        companionQRs.push({
          first_name: companion.first_name,
          last_name: companion.last_name,
          relationship: companion.relationship || "",
          qr_code: companion.qr_code,
          qr_image_url: companionUrlData?.publicUrl || "",
        });
      }
      
      console.log("Generated", companionQRs.length, "companion QR codes");
    }

    // Relationship labels for Spanish display
    const relationshipLabels: Record<string, string> = {
      mother: "Madre",
      father: "Padre",
      guardian: "Tutor/a legal",
      grandparent: "Abuelo/a",
      sibling: "Hermano/a mayor",
      other: "Otro familiar",
    };

    // Generate companions HTML section
    let companionsHtml = "";
    if (companionQRs.length > 0) {
      const companionCards = companionQRs.map((c) => `
        <div style="display: inline-block; width: 48%; min-width: 200px; vertical-align: top; margin: 10px 1%; text-align: center; background-color: #f9fafb; border-radius: 8px; padding: 20px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Acompañante</p>
          <p style="font-weight: 600; color: #1f2937; margin: 0 0 5px 0;">${c.first_name} ${c.last_name}</p>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 15px 0;">${relationshipLabels[c.relationship] || c.relationship}</p>
          <img src="${c.qr_image_url}" alt="QR ${c.first_name}" style="width: 140px; height: 140px; display: block; margin: 0 auto;" />
          <p style="color: #7c3aed; font-size: 12px; font-family: monospace; margin: 10px 0 0 0;">${c.qr_code}</p>
        </div>
      `).join("");

      companionsHtml = `
        <!-- Companion QR Codes Section -->
        <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
          <h3 style="color: #1f2937; font-size: 18px; text-align: center; margin: 0 0 20px 0;">
            🎫 Entradas de Acompañantes (${companionQRs.length})
          </h3>
          <div style="text-align: center;">
            ${companionCards}
          </div>
        </div>
      `;
    }

    // Dynamic important note based on companions
    const importantNoteText = companionQRs.length > 0
      ? `<strong>⚠️ Importante:</strong> Cada persona debe presentar su propio código QR en la entrada del evento. Los acompañantes también necesitan mostrar sus entradas individuales.`
      : `<strong>⚠️ Importante:</strong> Presenta el código QR de tu entrada en la entrada del evento para acceder. Puedes mostrarlo desde tu móvil o imprimirlo.`;

    // Convert plain text body to HTML with line breaks
    const emailBodyHtml = emailBodyText
      .split("\n")
      .map((line) => `<p style="margin: 0 0 10px 0;">${line || "&nbsp;"}</p>`)
      .join("");

    // Send email using Brevo API
    const emailPayload: Record<string, unknown> = {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: registration.email }],
      subject: emailSubject,
      htmlContent: `
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
                      ¡Inscripción confirmada!
                    </h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                      Technovation Girls Madrid
                    </p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                    ${emailBodyHtml}
                    
                    <!-- QR Code Section -->
                    <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">Tu código QR de acceso:</p>
                      ${qrImageUrl ? `<img src="${qrImageUrl}" alt="Código QR" style="width: 200px; height: 200px; display: block; margin: 0 auto;" />` : "<p>Error generando QR</p>"}
                      <p style="color: #7c3aed; font-size: 14px; font-weight: 600; font-family: monospace; margin: 15px 0 0 0;">
                        ${registration.registration_number}
                      </p>
                    </div>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Ver mi entrada
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    ${companionsHtml}
                    
                    <!-- Important Note -->
                    <table width="100%" style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 20px;">
                      <tr>
                        <td>
                          <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                            ${importantNoteText}
                          </p>
                        </td>
                      </tr>
                    </table>
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
    `,
    };

    // Add reply-to: use custom template value or fall back to env var
    const effectiveReplyTo = replyToEmail || BREVO_REPLY_TO_EMAIL;
    emailPayload.replyTo = { email: effectiveReplyTo };

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY!,
      },
      body: JSON.stringify(emailPayload),
    });

    const emailData = await emailResponse.json();
    console.log("Email response:", emailData);

    if (!emailResponse.ok) {
      throw new Error(`Failed to send email: ${JSON.stringify(emailData)}`);
    }

    console.log("Email sent successfully");

    return new Response(JSON.stringify({ success: true, emailId: emailData.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-registration-confirmation function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
