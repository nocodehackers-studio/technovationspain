import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

Deno.serve(async (req: Request): Promise<Response> => {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // F7: Filter by date in SQL — only fetch assignments for expired events (+1 day buffer)
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data: toDeactivate, error: queryError } = await supabase
      .from("judge_assignments")
      .select("id, user_id, event_id, events!inner(id, date)")
      .eq("is_active", true)
      .lt("events.date", cutoffDate);

    if (queryError) {
      throw new Error(`Error querying judge assignments: ${queryError.message}`);
    }

    if (!toDeactivate || toDeactivate.length === 0) {
      console.log("No expired judge assignments found");
      return new Response(
        JSON.stringify({ success: true, deactivated_assignments: 0, deactivated_profiles: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Deactivate expired assignments
    const assignmentIds = toDeactivate.map((a) => a.id);
    const { error: deactivateError } = await supabase
      .from("judge_assignments")
      .update({ is_active: false })
      .in("id", assignmentIds);

    if (deactivateError) {
      throw new Error(`Error deactivating assignments: ${deactivateError.message}`);
    }

    // Update profiles for affected users
    const affectedUserIds = [...new Set(toDeactivate.map((a) => a.user_id))];
    let deactivatedProfiles = 0;

    for (const userId of affectedUserIds) {
      // Check if user has any remaining active assignments
      const { data: remainingActive } = await supabase
        .from("judge_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1);

      if (!remainingActive || remainingActive.length === 0) {
        // No remaining active assignments — update profile
        // Check user's role
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (userRole?.role === "collaborator") {
          // Judge-only user: deactivate fully
          await supabase
            .from("profiles")
            .update({ is_judge: false, is_active: false })
            .eq("id", userId);
        } else {
          // Has primary role (mentor, participant, etc.): only remove judge flag
          await supabase
            .from("profiles")
            .update({ is_judge: false })
            .eq("id", userId);
        }
        deactivatedProfiles++;
      }
    }

    console.log(`Deactivated ${assignmentIds.length} assignments, ${deactivatedProfiles} profiles`);

    return new Response(
      JSON.stringify({
        success: true,
        deactivated_assignments: assignmentIds.length,
        deactivated_profiles: deactivatedProfiles,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("deactivate-expired-judges failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
