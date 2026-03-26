import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parse } from "https://deno.land/std@0.190.0/csv/mod.ts";
// ─── ENV & CONSTANTS ────────────────────────────────────────────────
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Technovation Girls Madrid";
const ALLOWED_ORIGINS = [
  "https://app.powertocode.org",
  "https://powertocode.vercel.app",
  "https://powertocode-git-staging-nocodehackers.vercel.app"
];
const MAX_RETRIES = 3;
const PROFILE_POLL_DELAY_MS = 200;
const PROFILE_POLL_RETRIES = 3;
// ─── CORS ───────────────────────────────────────────────────────────
function getCorsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  };
}
// ─── HELPERS ────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve)=>setTimeout(resolve, ms));
}
function normalizeEmail(email) {
  return email.toLowerCase().trim();
}
function trimField(val) {
  const trimmed = (val ?? "").trim();
  if (trimmed === "-" || trimmed === "--" || trimmed === "—") return "";
  return trimmed;
}
function stripNulls(obj) {
  const result = {};
  for (const [key, val] of Object.entries(obj)){
    if (val !== null && val !== "") result[key] = val;
  }
  return result;
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// ─── MAIN HANDLER ───────────────────────────────────────────────────
Deno.serve(async (req)=>{
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({
      error: "No token provided"
    }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  // Parse body
  let importId;
  try {
    const body = await req.json();
    importId = body.importId;
    if (!importId) throw new Error("Missing importId");
  } catch  {
    return new Response(JSON.stringify({
      error: "Invalid request body — requires importId"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  // Verify JWT — admin check (F4: use has_role RPC)
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({
      error: "Invalid token"
    }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  // Service role client for all DB operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  // Check admin role via has_role RPC (consistent with codebase pattern)
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin"
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({
      error: "Forbidden — admin role required"
    }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  // F2: Process synchronously — no background IIFE, Deno guarantees execution
  // while the response hasn't been returned yet
  const counters = {
    records_processed: 0,
    records_new: 0,
    records_updated: 0,
    errors: []
  };
  try {
    // ── Validate import record and CAS pending → processing ──
    const { data: importRecord, error: importError } = await supabase.from("csv_imports").update({
      status: "processing"
    }).eq("id", importId).eq("status", "pending").select("id, storage_paths, admin_email").single();
    if (importError || !importRecord) {
      throw new Error(`Import record not found or not in pending state: ${importId}`);
    }
    // ── Download and parse CSV (F9: single parse, no dual-parse) ──
    const storagePaths = importRecord.storage_paths;
    const judgesCsvPath = storagePaths?.judges_csv;
    if (!judgesCsvPath) {
      throw new Error("No judges CSV path found in import record");
    }
    const { data: fileData, error: downloadError } = await supabase.storage.from("csv-imports").download(judgesCsvPath);
    if (downloadError || !fileData) {
      throw new Error(`Failed to download CSV: ${downloadError?.message}`);
    }
    const csvText = await fileData.text();
    // Parse all rows including header as string[][], then split
    const allRows = parse(csvText, { skipFirstRow: false });
    const headers = allRows.length > 0 ? allRows[0] : [];
    const parsedRows = allRows.slice(1);
    // Find column indices (case-insensitive, trim whitespace including \r)
    const findCol = (name)=>headers.findIndex((h)=>h.trim().replace(/\r/g, "").toLowerCase() === name.toLowerCase());
    const emailIdx = findCol("Email");
    if (emailIdx === -1) {
      throw new Error(`CSV missing required column: "Email". Found: ${headers.map((h)=>h.trim()).join(", ")}`);
    }
    const firstNameIdx = findCol("First name");
    const lastNameIdx = findCol("Last name");
    const companyIdx = findCol("Get school company name");
    // ── Deduplicate by email ──
    const rowsByEmail = new Map();
    const duplicateEmails = [];
    for (const row of parsedRows){
      const rawEmail = row[emailIdx];
      if (!rawEmail) continue;
      const email = normalizeEmail(rawEmail);
      if (!email || !email.includes("@")) continue;
      if (rowsByEmail.has(email)) {
        duplicateEmails.push(email);
      }
      rowsByEmail.set(email, row); // Last occurrence wins
    }
    if (duplicateEmails.length > 0) {
      counters.errors.push({
        error: `Duplicate emails (last occurrence used): ${[
          ...new Set(duplicateEmails)
        ].join(", ")}`
      });
    }
    // Update total_records on import
    await supabase.from("csv_imports").update({
      total_records: rowsByEmail.size
    }).eq("id", importId);
    // ── Batch lookup existing profiles ──
    const emails = [
      ...rowsByEmail.keys()
    ];
    const existingProfiles = new Map();
    for(let i = 0; i < emails.length; i += 50){
      const batch = emails.slice(i, i + 50);
      const { data: profiles } = await supabase.from("profiles").select("id, email, verification_status").in("email", batch);
      if (profiles) {
        for (const p of profiles){
          existingProfiles.set(normalizeEmail(p.email), {
            id: p.id,
            verification_status: p.verification_status
          });
        }
      }
    }
    // ── Process each row ──
    for (const [email, row] of rowsByEmail){
      try {
        const firstName = firstNameIdx >= 0 ? trimField(row[firstNameIdx]) : "";
        const lastName = lastNameIdx >= 0 ? trimField(row[lastNameIdx]) : "";
        const companyName = companyIdx >= 0 ? trimField(row[companyIdx]) : "";
        const profileFields = stripNulls({
          first_name: firstName || null,
          last_name: lastName || null,
          company_name: companyName || null
        });
        const existing = existingProfiles.get(email);
        if (existing) {
          // ── Existing user ──
          const profileUpdate = {
            ...profileFields,
            is_judge: true,
            is_active: true
          };
          if (existing.verification_status === "pending") {
            profileUpdate.verification_status = "verified";
          }
          await supabase.from("profiles").update(profileUpdate).eq("id", existing.id);
          // Do NOT touch user_roles for existing users
          // No judge_assignments row created — event assignment happens separately
          counters.records_updated++;
        } else {
          // ── New user ──
          let userId = null;
          let retries = 0;
          while(retries < MAX_RETRIES){
            try {
              const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true
              });
              if (createError) {
                if (createError.message?.includes("already been registered")) {
                  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
                  if (existingProfile) {
                    userId = existingProfile.id;
                    break;
                  }
                }
                throw createError;
              }
              userId = authUser.user.id;
              break;
            } catch (err) {
              retries++;
              if (retries >= MAX_RETRIES) throw err;
              await sleep(1000 * retries);
            }
          }
          if (!userId) {
            throw new Error(`Failed to create auth user for ${email}`);
          }
          // Poll for profile creation (handle_new_user trigger)
          let profileCreated = false;
          for(let i = 0; i < PROFILE_POLL_RETRIES; i++){
            await sleep(PROFILE_POLL_DELAY_MS);
            const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
            if (profile) {
              profileCreated = true;
              break;
            }
          }
          if (!profileCreated) {
            throw new Error(`Profile not created after polling for ${email}`);
          }
          // Update profile
          await supabase.from("profiles").update({
            ...profileFields,
            is_judge: true,
            is_active: true,
            verification_status: "verified"
          }).eq("id", userId);
          // Insert role = collaborator (new users only)
          await supabase.from("user_roles").insert({
            user_id: userId,
            role: "collaborator"
          });
          // No judge_assignments row created — event assignment happens separately
          counters.records_new++;
        }
        counters.records_processed++;
        // Update progress periodically
        if (counters.records_processed % 10 === 0) {
          await supabase.from("csv_imports").update({
            records_processed: counters.records_processed,
            records_new: counters.records_new,
            records_updated: counters.records_updated
          }).eq("id", importId);
        }
      } catch (err) {
        counters.errors.push({
          email,
          error: err instanceof Error ? err.message : String(err)
        });
        counters.records_processed++;
      }
    }
    // ── Finalize: mark completed ──
    await supabase.from("csv_imports").update({
      status: "completed",
      records_processed: counters.records_processed,
      records_new: counters.records_new,
      records_updated: counters.records_updated,
      errors: counters.errors.length > 0 ? counters.errors : null
    }).eq("id", importId);
    // Delete CSV from storage
    await supabase.storage.from("csv-imports").remove([
      judgesCsvPath
    ]);
    // Send notification email to admin
    if (BREVO_API_KEY && importRecord.admin_email) {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sender: {
              email: BREVO_SENDER_EMAIL,
              name: BREVO_SENDER_NAME
            },
            to: [
              {
                email: importRecord.admin_email
              }
            ],
            subject: `Importación de jueces completada`,
            htmlContent: `<p>La importación de jueces ha finalizado.</p>
<ul>
  <li>Nuevos: ${counters.records_new}</li>
  <li>Actualizados: ${counters.records_updated}</li>
  <li>Errores: ${counters.errors.length}</li>
</ul>`
          })
        });
      } catch (emailErr) {
        console.error("Failed to send admin notification email:", emailErr);
      }
    }
    console.log(`Judge CSV import completed: ${counters.records_new} new, ${counters.records_updated} updated, ${counters.errors.length} errors`);
    return new Response(JSON.stringify({
      status: "completed",
      records_new: counters.records_new,
      records_updated: counters.records_updated,
      errors: counters.errors.length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (err) {
    console.error("Judge CSV import failed:", err);
    await supabase.from("csv_imports").update({
      status: "failed",
      errors: [
        {
          error: err instanceof Error ? err.message : String(err)
        }
      ],
      records_processed: counters.records_processed,
      records_new: counters.records_new,
      records_updated: counters.records_updated
    }).eq("id", importId);
    return new Response(JSON.stringify({
      status: "failed",
      error: err instanceof Error ? err.message : String(err)
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});
