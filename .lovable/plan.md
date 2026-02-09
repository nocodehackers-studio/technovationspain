

# Fix: Reports and Event Stats Data Export

## Issues Found

### 1. Reports > Users tab: not updating properly
The user stats query fetches `profiles` with `select("created_at, verification_status")` but Supabase has a default limit of 1000 rows. If there are more than 1000 profiles, recent registrations won't appear. The fix is to paginate or use a count query.

### 2. Reports > Events tab: only showing companions
The event stats query (lines 109-132) tries to join `profiles` and `user_roles` via `event_registrations`, but those foreign keys don't exist. The `roleBreakdown` object is initialized but never populated -- `participants` and `mentors` stay at 0. Only `companions` gets a value. Additionally, the "Exportar Lista" button just shows a placeholder `toast.info("Exportacion en desarrollo")`.

### 3. Reports > Export tab: team members export is raw IDs
The `exportTable("team_members", ...)` does a raw `select("*")`, which only exports `user_id` and `team_id` UUIDs -- not useful. The teams export also lacks student/mentor counts and their names.

### 4. Reports > Export tab: toast says "exportado correctamente" instead of "Exportacion en curso"
The `exportTable` function uses `toast.loading()` then immediately dismisses it after the query completes and shows a success toast. The user wants to see "Exportacion en curso" as the loading message.

### 5. Event Stats CSV export: missing team_name and companion details
The `handleExport` in `EventStatsView.tsx` doesn't include `team_name`. The registration query doesn't fetch it either. Companion names/details are also not included in the export.

---

## Plan

### A. Fix Reports > Users tab (data limit)
- Add `.limit(10000)` or use multiple paginated fetches to ensure all profiles are returned.

### B. Fix Reports > Events tab stats
- Rewrite the event stats query to use `event_ticket_types` (like the working `EventStatsView` does) instead of non-existent joins.
- Calculate participants vs mentors/judges from `ticket_type.allowed_roles`.
- Wire the "Exportar Lista" button to actually download the event registrations CSV (reuse `exportEventRegistrations`).

### C. Fix Export tab: team members and teams exports
- **Team Members**: Replace raw `select("*")` with a custom query that joins profiles (name, email) and teams (team name), exporting human-readable data.
- **Teams**: Add a custom export that includes team name, hub, category, student count, mentor count, and lists student/mentor names and emails.
- Remove the "Acompanantes" standalone export button (user says it's not useful).
- Replace "Estudiantes Autorizados" with "Usuarios Autorizados" (table was migrated to `authorized_users`).

### D. Fix toast message
- Change `toast.loading` message from "Exportando..." to "Exportacion en curso..." and keep it visible until download completes.

### E. Fix Event Stats export (EventStatsView.tsx)
- Add `team_name` to the registration query and CSV export.
- Fetch companion details (first_name, last_name, relationship) for each registration and include them as additional rows or columns in the CSV.

---

## Technical Details

### Files to modify:
1. **`src/pages/admin/AdminReports.tsx`**
   - Users query: add `.limit(10000)` to profiles fetch
   - Events tab: rewrite `eventStats` query to use ticket types for role breakdown; wire export button
   - Export tab: replace `exportTable("team_members")` with custom `exportTeamMembers()` that joins profiles+teams
   - Export tab: replace `exportTable("teams")` with custom `exportTeamsWithMembers()` that includes counts and member names
   - Export tab: remove "Acompanantes" button, fix "authorized_students" to "authorized_users"
   - Change toast messages to "Exportacion en curso"

2. **`src/components/admin/events/EventStatsView.tsx`**
   - Add `team_name` to the registration select query (line 62)
   - Add `team_name` column to the table
   - Add `team_name` to the CSV export `handleExport`
   - Fetch companion details and append them to the CSV (as sub-rows under each registration, with columns: Nombre acompanante, Apellido, Parentesco)

