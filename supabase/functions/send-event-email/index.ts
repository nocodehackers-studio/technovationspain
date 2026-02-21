import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation Girls Madrid";
const BREVO_REPLY_TO_EMAIL = Deno.env.get("BREVO_REPLY_TO_EMAIL") || "soporte@powertocode.org";

const ALLOWED_ORIGINS = [
  "https://app.powertocode.org",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

interface SendEventEmailRequest {
  eventId: string;
  templateType: "reminder";
  targetAudience: "all_confirmed" | "ticket_type";
  ticketTypeId?: string;
  scheduleFor?: string; // ISO datetime
}

// Default reminder template
const DEFAULT_REMINDER_SUBJECT = "¡Te esperamos mañana en {evento}!";
const DEFAULT_REMINDER_BODY = `Hola {nombre},

Te recordamos que mañana es el evento "{evento}".

📅 Fecha: {fecha}
🕐 Horario: {hora}
📍 Lugar: {ubicacion}
   {direccion}, {ciudad}

No olvides llevar:
- Tu entrada (la encontrarás en {enlace_entrada})
- Documento de identidad
- Muchas ganas de aprender

¡Nos vemos pronto!

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

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  console.log("send-event-email function called");

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

    // Check if user is admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      console.error("User is not an admin");
      return new Response(
        JSON.stringify({ error: "Forbidden - admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { eventId, templateType, targetAudience, ticketTypeId, scheduleFor }: SendEventEmailRequest =
      await req.json();

    console.log("Request params:", { eventId, templateType, targetAudience, ticketTypeId, scheduleFor });

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      console.error("Event not found:", eventError);
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch custom template if exists
    const { data: customTemplate } = await supabase
      .from("event_email_templates")
      .select("*")
      .eq("event_id", eventId)
      .eq("template_type", templateType)
      .eq("is_active", true)
      .maybeSingle();

    const subjectTemplate = customTemplate?.subject || DEFAULT_REMINDER_SUBJECT;
    const bodyTemplate = customTemplate?.body_content || DEFAULT_REMINDER_BODY;
    const replyToEmail = customTemplate?.reply_to_email || null;

    // Build query for registrations
    let query = supabase
      .from("event_registrations")
      .select("id, email, first_name, last_name, registration_number, ticket_type:event_ticket_types(name)")
      .eq("event_id", eventId)
      .eq("registration_status", "confirmed")
      .eq("is_companion", false)
      .not("email", "is", null);

    if (targetAudience === "ticket_type" && ticketTypeId) {
      query = query.eq("ticket_type_id", ticketTypeId);
    }

    const { data: registrations, error: regError } = await query;

    if (regError) {
      console.error("Error fetching registrations:", regError);
      throw new Error("Error fetching registrations");
    }

    const recipientsCount = registrations?.length || 0;
    console.log(`Found ${recipientsCount} recipients`);

    // Format date
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Subject with event name
    const baseSubject = replaceVariables(subjectTemplate, { "{evento}": event.name });

    // If scheduled, just save to database
    if (scheduleFor) {
      const { error: insertError } = await supabase
        .from("event_email_sends")
        .insert({
          event_id: eventId,
          template_type: templateType,
          subject: baseSubject,
          body_content: bodyTemplate,
          recipients_count: recipientsCount,
          target_audience: targetAudience,
          target_ticket_type_id: targetAudience === "ticket_type" ? ticketTypeId : null,
          status: "scheduled",
          scheduled_for: scheduleFor,
          sent_by: user.id,
        });

      if (insertError) {
        console.error("Error saving scheduled send:", insertError);
        throw new Error("Error saving scheduled send");
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          scheduled: true, 
          recipientsCount,
          scheduledFor: scheduleFor 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Immediate send
    if (recipientsCount === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No recipients found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create send record
    const { data: sendRecord, error: sendRecordError } = await supabase
      .from("event_email_sends")
      .insert({
        event_id: eventId,
        template_type: templateType,
        subject: baseSubject,
        body_content: bodyTemplate,
        recipients_count: recipientsCount,
        target_audience: targetAudience,
        target_ticket_type_id: targetAudience === "ticket_type" ? ticketTypeId : null,
        status: "processing",
        sent_by: user.id,
      })
      .select()
      .single();

    if (sendRecordError) {
      console.error("Error creating send record:", sendRecordError);
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Send emails with rate limiting
    for (const registration of registrations || []) {
      try {
        const ticketUrl = `https://app.powertocode.org/tickets/${registration.id}`;

        const templateVars: Record<string, string> = {
          "{nombre}": registration.first_name || "",
          "{apellido}": registration.last_name || "",
          "{nombre_completo}": `${registration.first_name || ""} ${registration.last_name || ""}`.trim(),
          "{evento}": event.name || "",
          "{fecha}": formattedDate,
          "{hora}": `${event.start_time || ""} - ${event.end_time || ""}`,
          "{ubicacion}": event.location_name || "",
          "{direccion}": event.location_address || "",
          "{ciudad}": event.location_city || "",
          "{numero_registro}": registration.registration_number || "",
          "{tipo_entrada}": (registration.ticket_type as { name?: string })?.name || "General",
          "{enlace_entrada}": ticketUrl,
        };

        const emailSubject = replaceVariables(subjectTemplate, templateVars);
        const emailBodyText = replaceVariables(bodyTemplate, templateVars);

        // Convert plain text to HTML
        const emailBodyHtml = emailBodyText
          .split("\n")
          .map((line) => `<p style="margin: 0 0 10px 0;">${line || "&nbsp;"}</p>`)
          .join("");

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
                          Recordatorio
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
                        
                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 30px 0 20px 0;">
                              <a href="${ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                Ver mi entrada
                              </a>
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

        if (emailResponse.ok) {
          sentCount++;
        } else {
          const errorData = await emailResponse.json();
          failedCount++;
          errors.push(`${registration.email}: ${JSON.stringify(errorData)}`);
        }

        // Rate limiting - 100ms between emails
        await delay(100);
      } catch (emailError: unknown) {
        failedCount++;
        const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
        errors.push(`${registration.email}: ${errorMessage}`);
      }
    }

    // Update send record
    if (sendRecord) {
      await supabase
        .from("event_email_sends")
        .update({
          status: failedCount === recipientsCount ? "failed" : "sent",
          sent_at: new Date().toISOString(),
          recipients_count: sentCount,
          error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
        })
        .eq("id", sendRecord.id);
    }

    console.log(`Email sending complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        errors: errors.slice(0, 5),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-event-email function:", errorMessage);
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
