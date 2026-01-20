import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RegistrationEmailRequest {
  registrationId: string;
}

const handler = async (req: Request): Promise<Response> => {
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

    // Format date
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build the ticket URL
    const ticketUrl = `https://technovationspain.lovable.app/tickets/${registration.id}`;

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Technovation España <onboarding@resend.dev>",
        to: [registration.email],
        subject: `¡Inscripción confirmada! - ${event.name}`,
        html: `
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
                        Technovation Girls España
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Hola <strong>${registration.first_name}</strong>,
                      </p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Gracias por registrarte en <strong>${event.name}</strong>. Tu inscripción ha sido confirmada.
                      </p>
                      
                      <!-- Event Details Card -->
                      <table width="100%" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <tr>
                          <td>
                            <h2 style="color: #111827; font-size: 18px; margin: 0 0 20px 0;">
                              Detalles del evento
                            </h2>
                            
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Evento:</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${event.name}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha:</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${formattedDate}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Hora:</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${event.start_time || ''} - ${event.end_time || ''}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Ubicación:</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">
                                  ${event.location_name || ''}<br>
                                  <span style="font-weight: normal; color: #6b7280;">${event.location_address || ''}, ${event.location_city || ''}</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tipo de entrada:</td>
                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${ticketType?.name || 'General'}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Nº de registro:</td>
                                <td style="padding: 8px 0; color: #7c3aed; font-size: 14px; font-weight: 600; font-family: monospace;">${registration.registration_number}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
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
                      
                      <!-- Important Note -->
                      <table width="100%" style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 20px;">
                        <tr>
                          <td>
                            <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                              <strong>⚠️ Importante:</strong> Presenta el código QR de tu entrada en la entrada del evento para acceder. Puedes mostrarlo desde tu móvil o imprimirlo.
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
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    if (!emailResponse.ok) {
      throw new Error(`Failed to send email: ${JSON.stringify(emailData)}`);
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-registration-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);