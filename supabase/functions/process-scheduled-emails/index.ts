import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation Girls Madrid";
const BREVO_REPLY_TO_EMAIL = Deno.env.get("BREVO_REPLY_TO_EMAIL") || "soporte@powertocode.org";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

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

// Format date in Spanish (F10: validate input)
function formatDateSpanish(dateStr: string | null | undefined): string {
  if (!dateStr) return "Fecha no disponible";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const handler = async (req: Request): Promise<Response> => {
  console.log("process-scheduled-emails function called");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // Authenticate via CRON_SECRET
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!CRON_SECRET || token !== CRON_SECRET) {
    console.error("Unauthorized: invalid or missing CRON_SECRET");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // F5: Validate required env vars early
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: BREVO_API_KEY missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // F1: Atomic claim — UPDATE + SELECT in one call prevents race conditions
    // with concurrent cron invocations picking up the same rows
    // F3: Limit to 10 records per invocation to avoid timeout on backlog
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from("event_email_sends")
      .update({ status: "processing" })
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .limit(10)
      .select("*");

    if (fetchError) {
      console.error("Error fetching scheduled emails:", fetchError);
      throw new Error(`Error fetching scheduled emails: ${fetchError.message}`);
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      console.log("No scheduled emails to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending emails" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${scheduledEmails.length} scheduled email(s) to process`);

    const results: { id: string; status: string; sent: number; error?: string }[] = [];

    // Process each scheduled email
    for (const emailRecord of scheduledEmails) {
      console.log(`Processing email record ${emailRecord.id} for event ${emailRecord.event_id}`);
      // Already marked as 'processing' by the atomic UPDATE+SELECT above

      try {
        // Fetch event data
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", emailRecord.event_id)
          .single();

        if (eventError || !event) {
          throw new Error(`Event not found: ${eventError?.message || "unknown"}`);
        }

        // Fetch custom template if exists
        const { data: customTemplate } = await supabase
          .from("event_email_templates")
          .select("*")
          .eq("event_id", emailRecord.event_id)
          .eq("template_type", emailRecord.template_type)
          .eq("is_active", true)
          .maybeSingle();

        const subjectTemplate = customTemplate?.subject || DEFAULT_REMINDER_SUBJECT;
        const bodyTemplate = customTemplate?.body_content || DEFAULT_REMINDER_BODY;
        const replyToEmail = customTemplate?.reply_to_email || null;

        // Query recipients: confirmed, not companion, with email
        let query = supabase
          .from("event_registrations")
          .select("id, email, first_name, last_name, registration_number, ticket_type:event_ticket_types(name)")
          .eq("event_id", emailRecord.event_id)
          .eq("registration_status", "confirmed")
          .eq("is_companion", false)
          .not("email", "is", null);

        if (emailRecord.target_audience === "ticket_type" && emailRecord.target_ticket_type_id) {
          query = query.eq("ticket_type_id", emailRecord.target_ticket_type_id);
        }

        const { data: registrations, error: regError } = await query;

        if (regError) {
          throw new Error(`Error fetching registrations: ${regError.message}`);
        }

        const recipientsCount = registrations?.length || 0;
        console.log(`Found ${recipientsCount} recipients for email ${emailRecord.id}`);

        if (recipientsCount === 0) {
          const { error: emptyUpdateError } = await supabase
            .from("event_email_sends")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              recipients_count: 0,
            })
            .eq("id", emailRecord.id);

          if (emptyUpdateError) {
            console.error(`Error updating empty send ${emailRecord.id}:`, emptyUpdateError);
          }

          results.push({ id: emailRecord.id, status: "sent", sent: 0 });
          continue;
        }

        // Format date
        const formattedDate = formatDateSpanish(event.date);

        let sentCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        // Send emails with rate limiting
        // Note: No per-recipient idempotency — if the function crashes mid-send,
        // a retry (next cron cycle) won't re-process this record because it's
        // already marked as 'processing'. Manual intervention needed for stuck records.
        for (const registration of registrations!) {
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

        // F6: Use "failed" only if ALL failed; "sent" otherwise (no partial_failure enum available)
        // F8: Include total error count so operators know if errors were truncated
        const finalStatus = failedCount === recipientsCount ? "failed" : "sent";
        const errorSummary = errors.length > 0
          ? `[${errors.length} total errors] ${errors.slice(0, 5).join("; ")}`
          : null;

        // F9: Log update errors instead of silently discarding
        const { error: updateError } = await supabase
          .from("event_email_sends")
          .update({
            status: finalStatus,
            sent_at: new Date().toISOString(),
            recipients_count: sentCount,
            error_message: errorSummary,
          })
          .eq("id", emailRecord.id);

        if (updateError) {
          console.error(`Error updating send record ${emailRecord.id}:`, updateError);
        }

        console.log(`Email ${emailRecord.id}: ${sentCount} sent, ${failedCount} failed`);
        results.push({
          id: emailRecord.id,
          status: finalStatus,
          sent: sentCount,
          error: errors.length > 0 ? `[${errors.length} errors] ${errors.slice(0, 3).join("; ")}` : undefined,
        });
      } catch (recordError: unknown) {
        const errorMessage = recordError instanceof Error ? recordError.message : "Unknown error";
        console.error(`Error processing email ${emailRecord.id}:`, errorMessage);

        // F9: Log update errors
        const { error: failUpdateError } = await supabase
          .from("event_email_sends")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", emailRecord.id);

        if (failUpdateError) {
          console.error(`Error updating failed status for ${emailRecord.id}:`, failUpdateError);
        }

        results.push({ id: emailRecord.id, status: "failed", sent: 0, error: errorMessage });
      }
    }

    console.log("Processing complete:", JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Fatal error in process-scheduled-emails:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
