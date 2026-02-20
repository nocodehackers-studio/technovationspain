import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parse } from "https://deno.land/std@0.190.0/csv/mod.ts";

// ─── ENV & CONSTANTS ────────────────────────────────────────────────
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_SENDER_EMAIL =
  Deno.env.get("BREVO_SENDER_EMAIL") || "comunicacion@powertocode.org";
const BREVO_SENDER_NAME =
  Deno.env.get("BREVO_SENDER_NAME") || "Technovation Girls Madrid";

const ALLOWED_ORIGINS = [
  "https://app.powertocode.org",
  "https://powertocode.vercel.app",
];

const BATCH_SIZE = 25;
const DEFAULT_DELAY_MS = 100;
const MAX_RETRIES = 3;
const PROFILE_POLL_DELAY_MS = 200;
const PROFILE_POLL_RETRIES = 3;

const ROLE_MAP: Record<string, string> = {
  student: "participant",
  participant: "participant",
  mentor: "mentor",
  judge: "judge",
  chapter_ambassador: "chapter_ambassador",
};

const REQUIRED_USERS_HEADERS = ["Email"];
const REQUIRED_TEAMS_HEADERS = ["Team ID"];

const IMPORT_SELECT_FIELDS =
  "id, file_name, status, storage_paths, admin_email, import_type, records_processed, records_new, records_updated, records_activated, total_records, errors";

// ─── CORS ───────────────────────────────────────────────────────────
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function trimField(val: string | undefined | null): string {
  return (val ?? "").trim();
}

function isValidEmail(email: string): boolean {
  const parts = email.split("@");
  return (
    parts.length === 2 &&
    parts[0].length > 0 &&
    parts[1].includes(".") &&
    !email.includes(" ")
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mapRole(csvProfileType: string): string | null {
  const key = csvProfileType.toLowerCase().trim().replace(/\s+/g, "_");
  const mapped = ROLE_MAP[key];
  if (!mapped || mapped === "admin") return null;
  return mapped;
}

function validateHeaders(
  headers: string[],
  required: string[],
  csvType: string
): void {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const req of required) {
    if (!lowerHeaders.includes(req.toLowerCase())) {
      throw new Error(
        `${csvType} CSV missing required column: "${req}". Found: ${headers.join(", ")}`
      );
    }
  }
}

// ─── TYPES ──────────────────────────────────────────────────────────
interface ImportRecord {
  id: string;
  file_name: string;
  status: string;
  storage_paths: { users_csv?: string; teams_csv?: string } | null;
  admin_email: string | null;
  import_type: string | null;
  records_processed: number;
  records_new: number;
  records_updated: number;
  records_activated: number;
  total_records: number;
  errors: Array<{ email?: string; tg_team_id?: string; error: string }> | null;
}

interface ExistingProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  tg_id: string | null;
  city: string | null;
  state: string | null;
  school_name: string | null;
  company_name: string | null;
  parent_name: string | null;
  parent_email: string | null;
  profile_type: string | null;
  verification_status: string | null;
}

interface Counters {
  records_processed: number;
  records_new: number;
  records_updated: number;
  records_activated: number;
  skipped: number;
  duplicates: number;
  errors: Array<{ email?: string; tg_team_id?: string; error: string }>;
}

// ─── MAIN HANDLER ───────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No token provided" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Parse body
  let importId: string;
  try {
    const body = await req.json();
    importId = body.importId;
    if (!importId) throw new Error("Missing importId");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const isChainCall = token === supabaseServiceKey;

  // Service role client for all DB operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let imp: ImportRecord;

  if (isChainCall) {
    // ─── CHAIN CALL: skip JWT, validate import is processing ───
    const { data } = await supabase
      .from("csv_imports")
      .select(IMPORT_SELECT_FIELDS)
      .eq("id", importId)
      .single();

    if (!data || data.status !== "processing") {
      return new Response(JSON.stringify({ error: "Import not active" }), {
        status: 409,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    imp = data as unknown as ImportRecord;
  } else {
    // ─── CLIENT CALL: verify JWT + admin role ───
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Attempt atomic claim: pending → processing
    const { data: claimed } = await supabase
      .from("csv_imports")
      .update({ status: "processing" })
      .eq("id", importId)
      .eq("status", "pending")
      .select(IMPORT_SELECT_FIELDS)
      .single();

    if (claimed) {
      imp = claimed as unknown as ImportRecord;
    } else {
      // Resume case: import already in processing status
      const { data: existing } = await supabase
        .from("csv_imports")
        .select(IMPORT_SELECT_FIELDS)
        .eq("id", importId)
        .eq("status", "processing")
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Import not found or already completed" }),
          {
            status: 409,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      imp = existing as unknown as ImportRecord;
    }
  }

  // ─── PROCESS BATCH ─────────────────────────────────────────────
  return await processBatch(
    supabase,
    imp,
    importId,
    supabaseUrl,
    supabaseServiceKey,
    corsHeaders
  );
});

// ─── BATCH PROCESSING ───────────────────────────────────────────────
async function processBatch(
  supabase: ReturnType<typeof createClient>,
  imp: ImportRecord,
  importId: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const currentOffset = imp.records_processed || 0;

  // Initialize counters from DB state
  const counters: Counters = {
    records_processed: currentOffset,
    records_new: imp.records_new || 0,
    records_updated: imp.records_updated || 0,
    records_activated: imp.records_activated || 0,
    skipped: 0,
    duplicates: 0,
    errors: Array.isArray(imp.errors) ? [...(imp.errors as unknown as Counters["errors"])] : [],
  };

  try {
    // ─── Download & Parse CSVs ───────────────────────────────
    const storagePaths = imp.storage_paths || {};
    let usersRows: Record<string, string>[] = [];
    let teamsRows: Record<string, string>[] = [];

    if (storagePaths.users_csv) {
      const { data: fileData, error: dlError } = await supabase.storage
        .from("csv-imports")
        .download(storagePaths.users_csv);
      if (dlError || !fileData) {
        throw new Error(`Failed to download users CSV: ${dlError?.message}`);
      }
      const csvText = await fileData.text();
      usersRows = parse(csvText, {
        skipFirstRow: true,
        columns: undefined,
      }) as unknown as Record<string, string>[];
      if (usersRows.length > 0) {
        validateHeaders(Object.keys(usersRows[0]), REQUIRED_USERS_HEADERS, "Users");
      }
    }

    if (storagePaths.teams_csv) {
      const { data: fileData, error: dlError } = await supabase.storage
        .from("csv-imports")
        .download(storagePaths.teams_csv);
      if (dlError || !fileData) {
        throw new Error(`Failed to download teams CSV: ${dlError?.message}`);
      }
      const csvText = await fileData.text();
      teamsRows = parse(csvText, {
        skipFirstRow: true,
        columns: undefined,
      }) as unknown as Record<string, string>[];
      if (teamsRows.length > 0) {
        validateHeaders(Object.keys(teamsRows[0]), REQUIRED_TEAMS_HEADERS, "Teams");
      }
    }

    // ─── Dedup users by email (Map preserves insertion order) ─
    const emailToRow = new Map<string, Record<string, string>>();
    let dupCount = 0;
    for (const row of usersRows) {
      const email = normalizeEmail(row["Email"] || row["email"] || "");
      if (!email) continue;
      if (!isValidEmail(email)) {
        counters.errors.push({ error: "Invalid email format (details omitted)" });
        continue;
      }
      if (emailToRow.has(email)) dupCount++;
      emailToRow.set(email, row);
    }
    const emailList = Array.from(emailToRow.keys());
    const userRowCount = emailList.length;

    if (dupCount > 0 && currentOffset === 0) {
      counters.errors.push({
        error: `${dupCount} duplicate email(s) found in CSV — last row used for each`,
      });
      counters.duplicates = dupCount;
    }

    // ─── Dedup teams by tg_team_id ───────────────────────────
    const teamMap = new Map<string, { tgTeamId: string; row: Record<string, string> }>();
    for (const row of teamsRows) {
      const tgTeamId = trimField(row["Team ID"] || row["team_id"]);
      if (!tgTeamId) continue;
      teamMap.set(tgTeamId, { tgTeamId, row });
    }
    const teamList = Array.from(teamMap.values());
    const teamRowCount = teamList.length;

    // ─── Correct total_records on first invocation ───────────
    if (currentOffset === 0) {
      await supabase
        .from("csv_imports")
        .update({ total_records: userRowCount + teamRowCount })
        .eq("id", importId);
    }

    console.log(
      `Batch: offset=${currentOffset}, userRows=${userRowCount}, teamRows=${teamRowCount}`
    );

    // ─── Route to correct phase ──────────────────────────────
    if (currentOffset < userRowCount) {
      await processUserBatch(
        supabase, emailList, emailToRow, currentOffset, BATCH_SIZE, counters
      );
    } else if (currentOffset < userRowCount + teamRowCount) {
      const teamOffset = currentOffset - userRowCount;
      await processTeamBatch(
        supabase, teamList, teamOffset, BATCH_SIZE, userRowCount, counters
      );
    } else {
      // All rows examined → finalize
      return await finalize(supabase, importId, counters, corsHeaders);
    }

    // ─── CAS checkpoint ─────────────────────────────────────
    const { data: checkpointResult } = await supabase
      .from("csv_imports")
      .update({
        records_processed: counters.records_processed,
        records_new: counters.records_new,
        records_updated: counters.records_updated,
        records_activated: counters.records_activated,
        errors:
          counters.errors.length > 0
            ? (counters.errors as unknown as Record<string, unknown>)
            : null,
      })
      .eq("id", importId)
      .eq("records_processed", currentOffset) // CAS guard
      .select("id");

    if (!checkpointResult || checkpointResult.length === 0) {
      console.log("CAS conflict — another invocation handled this batch. Exiting.");
      return new Response(JSON.stringify({ status: "deduped" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ─── Self-invoke (fire-and-forget) ───────────────────────
    const functionUrl = `${supabaseUrl}/functions/v1/process-csv-import`;
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ importId }),
    }).catch((err) => console.error("Self-invoke failed:", err.message));

    return new Response(
      JSON.stringify({
        status: "batch_complete",
        records_processed: counters.records_processed,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Batch processing failed:", msg);

    await supabase
      .from("csv_imports")
      .update({
        status: "failed",
        records_processed: counters.records_processed,
        records_new: counters.records_new,
        records_updated: counters.records_updated,
        records_activated: counters.records_activated,
        errors: [
          ...counters.errors,
          { error: msg },
        ] as unknown as Record<string, unknown>,
      })
      .eq("id", importId);

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

// ─── PROCESS USER BATCH ─────────────────────────────────────────────
async function processUserBatch(
  supabase: ReturnType<typeof createClient>,
  emailList: string[],
  emailToRow: Map<string, Record<string, string>>,
  offset: number,
  batchSize: number,
  counters: Counters
): Promise<void> {
  const batchEmails = emailList.slice(offset, offset + batchSize);

  // Mini-diff: fetch existing profiles for this batch only
  const { data: existingProfiles } = await supabase
    .from("profiles")
    .select(
      "id, email, first_name, last_name, phone, tg_id, city, state, school_name, company_name, parent_name, parent_email, profile_type, verification_status"
    )
    .in("email", batchEmails);

  const profileByEmail = new Map<string, ExistingProfile>();
  for (const p of (existingProfiles || []) as unknown as ExistingProfile[]) {
    profileByEmail.set(normalizeEmail(p.email), p);
  }

  // Fetch existing roles for found profiles
  const profileIds = Array.from(profileByEmail.values()).map((p) => p.id);
  const roleByUserId = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", profileIds);
    for (const r of existingRoles || []) {
      roleByUserId.set(r.user_id, r.role);
    }
  }

  // Process each email in batch
  for (const email of batchEmails) {
    const row = emailToRow.get(email)!;
    const csvData = extractProfileFields(row);
    const mappedRole = mapRole(row["Profile type"] || row["profile_type"] || "");
    const existing = profileByEmail.get(email);

    counters.records_processed++;

    try {
      if (!existing) {
        // ─── CREATE new user ─────────────────────────────────
        let userId: string | undefined;

        const { data: newUser, error: createError } =
          await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { intended_role: mappedRole },
          });

        if (createError) {
          if (
            createError.message?.includes("already been registered") ||
            createError.message?.includes("already exists")
          ) {
            // FIX F1: Profile lookup instead of broken listUsers
            const { data: existingProfile } = await supabase
              .from("profiles")
              .select("id")
              .eq("email", email)
              .maybeSingle();

            if (existingProfile) {
              userId = existingProfile.id;
            } else {
              counters.errors.push({
                error: "Auth user exists without profile (details omitted)",
              });
              continue;
            }
          } else if (
            createError.message?.includes("429") ||
            (createError as { status?: number }).status === 429
          ) {
            // Rate limit — exponential backoff
            let retried = false;
            for (let r = 0; r < MAX_RETRIES; r++) {
              await sleep(DEFAULT_DELAY_MS * Math.pow(2, r));
              const retry = await supabase.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: { intended_role: mappedRole },
              });
              if (!retry.error) {
                userId = retry.data.user.id;
                retried = true;
                break;
              }
            }
            if (!retried) {
              counters.errors.push({
                error: "Rate limit creating user (details omitted)",
              });
              continue;
            }
          } else {
            counters.errors.push({
              error: "Create user failed (details omitted)",
            });
            continue;
          }
        } else {
          userId = newUser.user.id;
        }

        // Poll for profile created by handle_new_user() trigger
        let profileReady = false;
        for (let p = 0; p < PROFILE_POLL_RETRIES; p++) {
          const { data: check } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", userId)
            .maybeSingle();
          if (check) {
            profileReady = true;
            break;
          }
          await sleep(PROFILE_POLL_DELAY_MS);
        }

        if (!profileReady) {
          counters.errors.push({
            error: "Profile not created by trigger (details omitted)",
          });
          continue;
        }

        // Update profile with CSV data + set verified
        await supabase
          .from("profiles")
          .update({ ...csvData, verification_status: "verified" })
          .eq("id", userId);

        if (mappedRole) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .upsert(
              { user_id: userId, role: mappedRole },
              { onConflict: "user_id" }
            );
          if (roleError) {
            counters.errors.push({
              error: "Role upsert failed for new user (details omitted)",
            });
          }
        }

        counters.records_new++;
      } else if (existing.verification_status === "pending") {
        // ─── ACTIVATE pending user ───────────────────────────
        await supabase
          .from("profiles")
          .update({ ...csvData, verification_status: "verified" })
          .eq("id", existing.id);

        if (mappedRole) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .upsert(
              { user_id: existing.id, role: mappedRole },
              { onConflict: "user_id" }
            );
          if (roleError) {
            counters.errors.push({
              error: "Role upsert failed for activated user (details omitted)",
            });
          }
        }

        counters.records_activated++;
      } else if (
        hasChanges(existing, csvData, mappedRole, roleByUserId.get(existing.id))
      ) {
        // ─── UPDATE existing user ────────────────────────────
        await supabase.from("profiles").update(csvData).eq("id", existing.id);

        if (mappedRole) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .upsert(
              { user_id: existing.id, role: mappedRole },
              { onConflict: "user_id" }
            );
          if (roleError) {
            counters.errors.push({
              error: "Role upsert failed for updated user (details omitted)",
            });
          }
        }

        counters.records_updated++;
      } else {
        // ─── SKIP — no changes needed ────────────────────────
        counters.skipped++;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown";
      counters.errors.push({ error: `User processing error: ${errMsg}` });
    }
  }
}

// ─── PROCESS TEAM BATCH ─────────────────────────────────────────────
async function processTeamBatch(
  supabase: ReturnType<typeof createClient>,
  teamList: Array<{ tgTeamId: string; row: Record<string, string> }>,
  teamOffset: number,
  batchSize: number,
  userRowCount: number,
  counters: Counters
): Promise<void> {
  const batchTeams = teamList.slice(teamOffset, teamOffset + batchSize);
  const batchTeamIds = batchTeams.map((t) => t.tgTeamId);

  // Diff: fetch existing teams for this batch
  const { data: existingTeams } = await supabase
    .from("teams")
    .select("id, tg_team_id, name, category, city, state")
    .in("tg_team_id", batchTeamIds);

  const teamByTgId = new Map<
    string,
    {
      id: string;
      tg_team_id: string;
      name: string;
      category: string | null;
      city: string | null;
      state: string | null;
    }
  >();
  for (const t of existingTeams || []) {
    if (t.tg_team_id) teamByTgId.set(t.tg_team_id, t);
  }

  // Create/update teams + collect internal IDs
  const tgToInternalId = new Map<string, string>();

  for (const { tgTeamId, row } of batchTeams) {
    const teamName = trimField(row["Name"] || row["name"]);
    const category = trimField(row["Division"] || row["division"]);
    const city = trimField(row["City"] || row["city"]);
    const state = trimField(row["State"] || row["state"]);

    const existing = teamByTgId.get(tgTeamId);

    if (!existing) {
      const { data: newTeam, error: insertErr } = await supabase
        .from("teams")
        .insert({
          tg_team_id: tgTeamId,
          name: teamName || `Team ${tgTeamId}`,
          category: category || null,
          city: city || null,
          state: state || null,
        })
        .select("id")
        .single();

      if (insertErr || !newTeam) {
        counters.errors.push({
          tg_team_id: tgTeamId,
          error: `Team insert failed: ${insertErr?.message}`,
        });
        continue;
      }
      tgToInternalId.set(tgTeamId, newTeam.id);
    } else {
      const changes: Record<string, string | null> = {};
      if (teamName && teamName !== existing.name) changes.name = teamName;
      if (category && category !== existing.category)
        changes.category = category;
      if (city && city !== existing.city) changes.city = city;
      if (state && state !== existing.state) changes.state = state;

      if (Object.keys(changes).length > 0) {
        await supabase.from("teams").update(changes).eq("id", existing.id);
      }
      tgToInternalId.set(tgTeamId, existing.id);
    }
  }

  // Link team members — collect all member emails from batch
  const allMemberEmails = new Set<string>();
  for (const { row } of batchTeams) {
    const studentEmails = parseEmailList(
      row["Student emails"] || row["student_emails"] || ""
    );
    const mentorEmails = parseEmailList(
      row["Mentor emails"] || row["mentor_emails"] || ""
    );
    for (const e of [...studentEmails, ...mentorEmails]) {
      allMemberEmails.add(e);
    }
  }

  // Fetch verified profiles for member emails in this batch
  const profileByEmail = new Map<string, { id: string; email: string }>();
  if (allMemberEmails.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("verification_status", "verified")
      .in("email", Array.from(allMemberEmails));
    for (const p of profiles || []) {
      if (p.email) profileByEmail.set(normalizeEmail(p.email), p);
    }
  }

  for (const { tgTeamId, row } of batchTeams) {
    const teamId = tgToInternalId.get(tgTeamId);
    if (!teamId) continue;

    const studentEmails = parseEmailList(
      row["Student emails"] || row["student_emails"] || ""
    );
    const mentorEmails = parseEmailList(
      row["Mentor emails"] || row["mentor_emails"] || ""
    );

    const { data: existingMembers } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId);
    const existingMemberIds = new Set(
      (existingMembers || []).map((m) => m.user_id)
    );

    for (const email of studentEmails) {
      const profile = profileByEmail.get(email);
      if (!profile) {
        counters.errors.push({
          tg_team_id: tgTeamId,
          error: "Unlinked email (student, details omitted)",
        });
        continue;
      }
      if (existingMemberIds.has(profile.id)) continue;

      const { error: linkErr } = await supabase.from("team_members").insert({
        team_id: teamId,
        user_id: profile.id,
        member_type: "participant",
      });
      if (linkErr && !linkErr.message?.includes("duplicate")) {
        counters.errors.push({
          tg_team_id: tgTeamId,
          error: "Link student failed (details omitted)",
        });
      }
    }

    for (const email of mentorEmails) {
      const profile = profileByEmail.get(email);
      if (!profile) {
        counters.errors.push({
          tg_team_id: tgTeamId,
          error: "Unlinked email (mentor, details omitted)",
        });
        continue;
      }
      if (existingMemberIds.has(profile.id)) continue;

      const { error: linkErr } = await supabase.from("team_members").insert({
        team_id: teamId,
        user_id: profile.id,
        member_type: "mentor",
      });
      if (linkErr && !linkErr.message?.includes("duplicate")) {
        counters.errors.push({
          tg_team_id: tgTeamId,
          error: "Link mentor failed (details omitted)",
        });
      }
    }
  }

  // Set final records_processed for this batch
  counters.records_processed = userRowCount + teamOffset + batchTeams.length;
}

// ─── FINALIZE ───────────────────────────────────────────────────────
async function finalize(
  supabase: ReturnType<typeof createClient>,
  importId: string,
  counters: Counters,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Atomic finalization — only one invocation succeeds
  const { data: finalized } = await supabase
    .from("csv_imports")
    .update({
      status: "completed",
      records_processed: counters.records_processed,
      records_new: counters.records_new,
      records_updated: counters.records_updated,
      records_activated: counters.records_activated,
      errors:
        counters.errors.length > 0
          ? (counters.errors as unknown as Record<string, unknown>)
          : null,
    })
    .eq("id", importId)
    .eq("status", "processing") // atomic guard
    .select("id, admin_email, storage_paths");

  if (!finalized || finalized.length === 0) {
    console.log("Another invocation already finalized. Exiting.");
    return new Response(JSON.stringify({ status: "already_finalized" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const adminEmail = (finalized[0] as unknown as { admin_email: string | null })
    .admin_email;
  const storagePaths = (
    finalized[0] as unknown as {
      storage_paths: { users_csv?: string; teams_csv?: string } | null;
    }
  ).storage_paths;

  // Best-effort: send notification email
  if (adminEmail && BREVO_API_KEY) {
    try {
      const emailCounters: Counters = {
        ...counters,
        skipped:
          counters.records_processed -
          counters.records_new -
          counters.records_updated -
          counters.records_activated,
      };
      await sendNotificationEmail(adminEmail, emailCounters);
    } catch (err) {
      console.error(
        "Notification email failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // Best-effort: delete CSV files from Storage
  const pathsToDelete: string[] = [];
  if (storagePaths?.users_csv) pathsToDelete.push(storagePaths.users_csv);
  if (storagePaths?.teams_csv) pathsToDelete.push(storagePaths.teams_csv);
  if (pathsToDelete.length > 0) {
    try {
      await supabase.storage.from("csv-imports").remove(pathsToDelete);
    } catch (err) {
      console.error(
        "Storage cleanup failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("Import completed:", {
    processed: counters.records_processed,
    new: counters.records_new,
    updated: counters.records_updated,
    activated: counters.records_activated,
    errors: counters.errors.length,
  });

  return new Response(
    JSON.stringify({
      status: "completed",
      records_processed: counters.records_processed,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}

// ─── EXTRACT PROFILE FIELDS ─────────────────────────────────────────
function extractProfileFields(
  row: Record<string, string>
): Record<string, string | null> {
  return {
    first_name: trimField(row["First name"] || row["first_name"]) || null,
    last_name: trimField(row["Last name"] || row["last_name"]) || null,
    phone: trimField(row["Phone number"] || row["phone"]) || null,
    tg_id:
      trimField(
        row["Participant ID"] || row["Mentor ID"] || row["tg_id"]
      ) || null,
    parent_name:
      trimField(row["Parent guardian name"] || row["parent_name"]) || null,
    parent_email:
      trimField(row["Parent guardian email"] || row["parent_email"]) || null,
    school_name: trimField(row["School name"] || row["school_name"]) || null,
    company_name:
      trimField(row["Company name"] || row["company_name"]) || null,
    city: trimField(row["City"] || row["city"]) || null,
    state: trimField(row["State"] || row["state"]) || null,
    profile_type:
      trimField(row["Profile type"] || row["profile_type"]) || null,
  };
}

// ─── HAS CHANGES ────────────────────────────────────────────────────
function hasChanges(
  existing: ExistingProfile,
  csvData: Record<string, string | null>,
  mappedRole: string | null,
  currentRole: string | undefined
): boolean {
  for (const [key, val] of Object.entries(csvData)) {
    if (val === null) continue;
    const existingVal = (existing as unknown as Record<string, string | null>)[
      key
    ];
    if ((existingVal || "") !== val) return true;
  }
  if (mappedRole && mappedRole !== currentRole) return true;
  return false;
}

// ─── PARSE EMAIL LIST ───────────────────────────────────────────────
function parseEmailList(commaSeparated: string): string[] {
  if (!commaSeparated.trim()) return [];
  return commaSeparated
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter((e) => e.length > 0 && e.includes("@"));
}

// ─── SEND NOTIFICATION EMAIL ────────────────────────────────────────
async function sendNotificationEmail(
  adminEmail: string,
  counters: Counters
): Promise<void> {
  try {
    const totalProcessed =
      counters.records_new +
      counters.records_updated +
      counters.records_activated;

    const subject =
      totalProcessed === 0 && counters.skipped > 0
        ? "Importación completada — No se detectaron cambios"
        : `Importación completada — ${counters.records_new} nuevos, ${counters.records_updated} actualizados`;

    const body = `
      <h2>Resultados de la importación</h2>
      <ul>
        <li><strong>Nuevos usuarios creados:</strong> ${counters.records_new}</li>
        <li><strong>Usuarios actualizados:</strong> ${counters.records_updated}</li>
        <li><strong>Usuarios activados (pendientes → verificados):</strong> ${counters.records_activated}</li>
        <li><strong>Sin cambios (omitidos):</strong> ${counters.skipped}</li>
        <li><strong>Emails duplicados en CSV:</strong> ${counters.duplicates}</li>
        <li><strong>Errores:</strong> ${counters.errors.length}</li>
      </ul>
      ${
        counters.errors.length > 0
          ? `<h3>Errores</h3><ul>${counters.errors
              .slice(0, 20)
              .map((e) => `<li>${escapeHtml(e.error)}</li>`)
              .join("")}</ul>${
              counters.errors.length > 20
                ? `<p>... y ${counters.errors.length - 20} errores más</p>`
                : ""
            }`
          : ""
      }
      ${
        totalProcessed === 0 && counters.skipped > 0
          ? "<p>No se detectaron cambios — todos los registros están actualizados.</p>"
          : ""
      }
    `.trim();

    const emailPayload = {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: adminEmail }],
      subject,
      htmlContent: body,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY!,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error("Brevo email error:", errData);
    } else {
      console.log("Notification email sent to admin");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("Failed to send notification email:", msg);
  }
}
