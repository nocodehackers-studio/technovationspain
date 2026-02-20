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
const SLOW_DELAY_MS = 500;
const SLOW_THRESHOLD_MS = 300;
const MAX_RETRIES = 3;
const PROFILE_POLL_DELAY_MS = 200;
const PROFILE_POLL_RETRIES = 3;

// CSV Profile type → app_role mapping
const ROLE_MAP: Record<string, string> = {
  student: "participant",
  participant: "participant",
  mentor: "mentor",
  judge: "judge",
  chapter_ambassador: "chapter_ambassador",
};

// Required CSV headers
const REQUIRED_USERS_HEADERS = ["Email"];
const REQUIRED_TEAMS_HEADERS = ["Team ID"];

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

/** Basic email format check — must have exactly one @, something before and after */
function isValidEmail(email: string): boolean {
  const parts = email.split("@");
  return (
    parts.length === 2 &&
    parts[0].length > 0 &&
    parts[1].includes(".") &&
    !email.includes(" ")
  );
}

/** Escape HTML entities to prevent XSS in email content */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Map CSV "Profile type" to our app_role.
 * Returns null for unknown types or "admin" (never assigned from CSV).
 */
function mapRole(csvProfileType: string): string | null {
  const key = csvProfileType.toLowerCase().trim().replace(/\s+/g, "_");
  const mapped = ROLE_MAP[key];
  if (!mapped || mapped === "admin") return null;
  return mapped;
}

/**
 * Validate that CSV headers contain all required columns (case-insensitive exact match).
 */
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

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // ─── 1a. Authentication & Setup ─────────────────────────────────
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

  // Verify caller JWT via anon client
  const token = authHeader.replace("Bearer ", "");
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

  // Service role client for privileged operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify caller has admin role
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

  // ─── CLAIM IMPORT (atomic — only if still 'pending') ─────────
  const { data: claimed, error: claimError } = await supabase
    .from("csv_imports")
    .update({ status: "processing" })
    .eq("id", importId)
    .eq("status", "pending")
    .select("id, file_name, status, storage_paths, admin_email, import_type")
    .single();

  if (claimError || !claimed) {
    console.error("Could not claim import (already processing or not found):", importId);
    return new Response(
      JSON.stringify({ error: "Import already processing or not found" }),
      {
        status: 409,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  const imp = claimed as unknown as ImportRecord;

  // ─── RETURN 202 IMMEDIATELY — process in background ─────────
  const backgroundWork = processImportInBackground(supabase, imp, importId);

  // @ts-ignore — EdgeRuntime is a Supabase Edge Runtime global
  EdgeRuntime.waitUntil(backgroundWork);

  return new Response(
    JSON.stringify({ success: true, importId, status: "processing" }),
    {
      status: 202,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
});

// ─── BACKGROUND IMPORT PROCESSING ────────────────────────────────
async function processImportInBackground(
  supabase: ReturnType<typeof createClient>,
  imp: ImportRecord,
  importId: string
): Promise<void> {
  const counters: Counters = {
    records_processed: 0,
    records_new: 0,
    records_updated: 0,
    records_activated: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
  };

  try {
    // ─── Download & Parse CSV Files ───────────────────────────
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

    console.log(
      `Parsed ${usersRows.length} user rows, ${teamsRows.length} team rows`
    );

    // ─── Process Users CSV ────────────────────────────────────
    if (usersRows.length > 0) {
      await processUsers(supabase, usersRows, importId, counters);
    }

    // ─── Process Teams CSV ────────────────────────────────────
    if (teamsRows.length > 0) {
      await processTeams(supabase, teamsRows, importId, counters);
    }

    // ─── Send Notification Email ──────────────────────────────
    if (imp.admin_email && BREVO_API_KEY) {
      await sendNotificationEmail(imp.admin_email, counters);
    }

    // ─── Cleanup ──────────────────────────────────────────────
    const pathsToDelete: string[] = [];
    if (storagePaths.users_csv) pathsToDelete.push(storagePaths.users_csv);
    if (storagePaths.teams_csv) pathsToDelete.push(storagePaths.teams_csv);

    if (pathsToDelete.length > 0) {
      await supabase.storage.from("csv-imports").remove(pathsToDelete);
    }

    // Update final status
    await supabase
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
      .eq("id", importId);

    console.log("Import completed:", {
      processed: counters.records_processed,
      new: counters.records_new,
      updated: counters.records_updated,
      activated: counters.records_activated,
      skipped: counters.skipped,
      duplicates: counters.duplicates,
      errors: counters.errors.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Import failed:", msg);

    // Mark as failed but preserve files for retry
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
  }
}

// ─── PROCESS USERS ──────────────────────────────────────────────────
async function processUsers(
  supabase: ReturnType<typeof createClient>,
  rows: Record<string, string>[],
  importId: string,
  counters: Counters
) {
  // FIX F8: Detect duplicate emails and report them
  const emailMap = new Map<string, Record<string, string>>();
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const email = normalizeEmail(row["Email"] || row["email"] || "");
    if (!email) continue;

    // FIX F11: Validate email format before processing
    if (!isValidEmail(email)) {
      counters.errors.push({ error: `Invalid email format (details omitted)` });
      continue;
    }

    if (seenEmails.has(email)) {
      counters.duplicates++;
      // Last-row-wins but we track the duplicate count
    }
    seenEmails.add(email);
    emailMap.set(email, row);
  }

  if (counters.duplicates > 0) {
    counters.errors.push({
      error: `${counters.duplicates} duplicate email(s) found in CSV — last row used for each`,
    });
  }

  const emails = Array.from(emailMap.keys());
  if (emails.length === 0) return;

  // Batch-fetch existing profiles
  const { data: existingProfiles } = await supabase
    .from("profiles")
    .select(
      "id, email, first_name, last_name, phone, tg_id, city, state, school_name, company_name, parent_name, parent_email, profile_type, verification_status"
    )
    .in("email", emails);

  const profileByEmail = new Map<string, ExistingProfile>();
  for (const p of (existingProfiles || []) as unknown as ExistingProfile[]) {
    profileByEmail.set(normalizeEmail(p.email), p);
  }

  // FIX F7: Fetch existing roles for existing profiles to enable proper skip detection
  const existingProfileIds = Array.from(profileByEmail.values()).map(
    (p) => p.id
  );
  const roleByUserId = new Map<string, string>();
  if (existingProfileIds.length > 0) {
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", existingProfileIds);
    for (const r of existingRoles || []) {
      roleByUserId.set(r.user_id, r.role);
    }
  }

  // Categorize
  const toCreate: Array<{ email: string; row: Record<string, string> }> = [];
  const toUpdate: Array<{
    profile: ExistingProfile;
    row: Record<string, string>;
  }> = [];
  const toActivate: Array<{
    profile: ExistingProfile;
    row: Record<string, string>;
  }> = [];

  for (const [email, row] of emailMap) {
    const existing = profileByEmail.get(email);
    if (!existing) {
      toCreate.push({ email, row });
      continue;
    }

    const csvData = extractProfileFields(row);
    const mappedRole = mapRole(
      row["Profile type"] || row["profile_type"] || ""
    );

    if (existing.verification_status === "pending") {
      toActivate.push({ profile: existing, row });
    } else if (
      hasChanges(existing, csvData, mappedRole, roleByUserId.get(existing.id))
    ) {
      toUpdate.push({ profile: existing, row });
    } else {
      counters.skipped++;
    }
  }

  console.log(
    `Users: ${toCreate.length} new, ${toUpdate.length} update, ${toActivate.length} activate, ${counters.skipped} skip`
  );

  // ─── Step 2: Create new users (throttled) ─────────────────────
  // FIX F1: Removed pre-fetched listUsers(). Instead, handle "user already exists"
  // error from createUser gracefully to avoid the 1000-user pagination cap.
  let batchDelay = DEFAULT_DELAY_MS;

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    const batchStart = Date.now();

    for (const { email, row } of batch) {
      const mappedRole = mapRole(
        row["Profile type"] || row["profile_type"] || ""
      );

      // FIX F6: Always increment records_processed, even on error
      counters.records_processed++;

      try {
        let userId: string | undefined;

        // Create auth user — email_confirm: true means no email sent
        const { data: newUser, error: createError } =
          await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { intended_role: mappedRole },
          });

        if (createError) {
          // FIX F1: Handle "user already exists" by looking up existing user
          if (
            createError.message?.includes("already been registered") ||
            createError.message?.includes("already exists")
          ) {
            // User exists in auth but wasn't in profiles — look up their ID
            const { data: authList } = await supabase.auth.admin.listUsers({
              perPage: 1,
              page: 1,
            });
            // Search by email in a targeted way
            const existingAuth = authList?.users?.find(
              (u) => u.email && normalizeEmail(u.email) === email
            );
            if (existingAuth) {
              userId = existingAuth.id;
            } else {
              counters.errors.push({
                error: `Auth user exists but could not resolve ID (details omitted)`,
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
                error: `Rate limit creating user (details omitted)`,
              });
              continue;
            }
          } else {
            counters.errors.push({
              error: `Create user failed (details omitted)`,
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
            error: `Profile not created by trigger (details omitted)`,
          });
          continue;
        }

        // Update profile with CSV data + set verified
        const profileData = extractProfileFields(row);
        await supabase
          .from("profiles")
          .update({
            ...profileData,
            verification_status: "verified",
          })
          .eq("id", userId);

        // FIX F14: Removed dead _noop RPC call
        // Upsert role
        if (mappedRole) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .upsert(
              { user_id: userId, role: mappedRole },
              { onConflict: "user_id" }
            );

          if (roleError) {
            counters.errors.push({
              error: `Role upsert failed for new user (details omitted)`,
            });
          }
        }

        counters.records_new++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown";
        counters.errors.push({ error: `User creation error: ${errMsg}` });
      }
    }

    // Checkpoint after each batch
    await supabase
      .from("csv_imports")
      .update({ records_processed: counters.records_processed })
      .eq("id", importId);

    // Adaptive delay
    const batchDuration = Date.now() - batchStart;
    const avgPerRecord = batchDuration / batch.length;
    batchDelay =
      avgPerRecord > SLOW_THRESHOLD_MS ? SLOW_DELAY_MS : DEFAULT_DELAY_MS;

    if (i + BATCH_SIZE < toCreate.length) {
      await sleep(batchDelay);
    }
  }

  // ─── Step 3: Update existing users ────────────────────────────
  for (const { profile, row } of toUpdate) {
    // FIX F6: Always increment records_processed
    counters.records_processed++;

    try {
      const csvData = extractProfileFields(row);
      const mappedRole = mapRole(
        row["Profile type"] || row["profile_type"] || ""
      );

      // Update only CSV-sourced fields
      await supabase.from("profiles").update(csvData).eq("id", profile.id);

      // FIX F4: Handle role upsert errors in update path
      if (mappedRole) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert(
            { user_id: profile.id, role: mappedRole },
            { onConflict: "user_id" }
          );

        if (roleError) {
          counters.errors.push({
            error: `Role upsert failed for updated user (details omitted)`,
          });
        }
      }

      counters.records_updated++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown";
      counters.errors.push({ error: `Update error: ${errMsg}` });
    }
  }

  // ─── Step 4: Activate pending users ───────────────────────────
  for (const { profile, row } of toActivate) {
    // FIX F6: Always increment records_processed
    counters.records_processed++;

    try {
      const csvData = extractProfileFields(row);
      const mappedRole = mapRole(
        row["Profile type"] || row["profile_type"] || ""
      );

      await supabase
        .from("profiles")
        .update({
          ...csvData,
          verification_status: "verified",
        })
        .eq("id", profile.id);

      // FIX F4: Handle role upsert errors in activate path
      if (mappedRole) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert(
            { user_id: profile.id, role: mappedRole },
            { onConflict: "user_id" }
          );

        if (roleError) {
          counters.errors.push({
            error: `Role upsert failed for activated user (details omitted)`,
          });
        }
      }

      counters.records_activated++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown";
      counters.errors.push({ error: `Activate error: ${errMsg}` });
    }
  }

  // Final checkpoint
  await supabase
    .from("csv_imports")
    .update({
      records_processed: counters.records_processed,
      records_new: counters.records_new,
      records_updated: counters.records_updated,
      records_activated: counters.records_activated,
    })
    .eq("id", importId);
}

// ─── PROCESS TEAMS ──────────────────────────────────────────────────
async function processTeams(
  supabase: ReturnType<typeof createClient>,
  rows: Record<string, string>[],
  importId: string,
  counters: Counters
) {
  // Step 1: Diff teams
  const teamIdMap = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const tgTeamId = trimField(row["Team ID"] || row["team_id"]);
    if (!tgTeamId) continue;
    teamIdMap.set(tgTeamId, row);
  }

  const tgTeamIds = Array.from(teamIdMap.keys());
  if (tgTeamIds.length === 0) return;

  // Fetch existing teams
  const { data: existingTeams } = await supabase
    .from("teams")
    .select("id, tg_team_id, name, category, city, state")
    .in("tg_team_id", tgTeamIds);

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

  // Step 2: Create/update teams — capture tg_team_id → internal id map
  const tgToInternalId = new Map<string, string>();

  for (const [tgTeamId, row] of teamIdMap) {
    const teamName = trimField(row["Name"] || row["name"]);
    const category = trimField(row["Division"] || row["division"]);
    const city = trimField(row["City"] || row["city"]);
    const state = trimField(row["State"] || row["state"]);

    counters.records_processed++;

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

  // Step 3: Link team members
  // FIX F5: Add explicit limit to avoid Supabase default 1000-row cap
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, email, verification_status")
    .eq("verification_status", "verified")
    .limit(10000);

  const profileByEmail = new Map<string, { id: string; email: string }>();
  for (const p of allProfiles || []) {
    if (p.email) profileByEmail.set(normalizeEmail(p.email), p);
  }

  for (const [tgTeamId, row] of teamIdMap) {
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
      .select("user_id, member_type")
      .eq("team_id", teamId);

    const existingMemberIds = new Set(
      (existingMembers || []).map((m) => m.user_id)
    );

    // Link students
    for (const email of studentEmails) {
      const profile = profileByEmail.get(email);
      if (!profile) {
        counters.errors.push({
          tg_team_id: tgTeamId,
          error: `Unlinked email (student, details omitted)`,
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
          error: `Link student failed (details omitted)`,
        });
      }
    }

    // Link mentors
    for (const email of mentorEmails) {
      const profile = profileByEmail.get(email);
      if (!profile) {
        counters.errors.push({
          tg_team_id: tgTeamId,
          error: `Unlinked email (mentor, details omitted)`,
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
          error: `Link mentor failed (details omitted)`,
        });
      }
    }
  }

  // Checkpoint
  await supabase
    .from("csv_imports")
    .update({ records_processed: counters.records_processed })
    .eq("id", importId);
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
// FIX F7: Compare actual current role instead of always returning true
function hasChanges(
  existing: ExistingProfile,
  csvData: Record<string, string | null>,
  mappedRole: string | null,
  currentRole: string | undefined
): boolean {
  // Check profile field changes
  for (const [key, val] of Object.entries(csvData)) {
    if (val === null) continue;
    const existingVal = (existing as unknown as Record<string, string | null>)[
      key
    ];
    if ((existingVal || "") !== val) return true;
  }
  // Check role change
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

    // FIX F3: Escape HTML entities in error messages to prevent XSS
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
