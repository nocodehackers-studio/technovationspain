
# Plan: Update Consent Text to Exact Legal Requirements

## Summary
The consent text needs to match the exact legal wording provided. Two components display consent text: the **ConsentModal** (shown during event registration) and the **ConsentPage** (public page for parents/guardians of minors). The ConsentModal is mostly correct but has minor differences. The ConsentPage uses a completely different simplified text and needs a full rewrite.

## Changes Found

### 1. ConsentModal.tsx (modal during registration) -- minor fixes
The full RGPD tables are already present and correct. Three differences need fixing:
- **"esta" accent**: Line 210 says "a favor de **esta**" but current code says "**esta**" -- actually, let me re-check... current code says "ésta" (with accent). The user's exact text uses "esta" (no accent). Fix needed.
- **"al haber sacado" vs "al sacar"**: Line 221 currently says "al sacar una entrada" but should say "al haber sacado una entrada"
- **Missing event location**: The final paragraph needs to include the venue address after the date (e.g., "en la Nave de Boetticher, C. Cifuentes, 5, Villaverde, 28021 Madrid")

### 2. ConsentPage.tsx (public page for minors) -- full rewrite of consent text
Lines 286-304 display a simplified paragraph that is completely different from the required legal text. This must be replaced with the full legal text including:
- The two introductory paragraphs about RGPD
- Table 1: "Informacion sobre proteccion de datos" (7 rows)
- Table 2: "Informacion especifica sobre el tratamiento de imagenes" (5 rows)
- The two closing paragraphs with dynamic event name/date/location
- Currently this page has no access to event details (name, date, location). A new edge function is needed to fetch this info from the consent_token.

### 3. EventRegistrationPage.tsx -- pass location to modal
- Currently passes `eventName` and `eventDate` to ConsentModal but not the location
- Needs to pass `eventLocation` constructed from `event.location_name`, `event.location_address`, `event.location_city`

### 4. New Edge Function: `get-consent-info`
- The public ConsentPage only has a `consent_token` and no authentication, so it cannot query event details directly
- A lightweight edge function will look up the consent_token in `event_registrations`, join to `events`, and return event name, date, and location fields
- Uses service role key (like the existing `submit-event-consent`)

## Technical Details

### File: `src/components/events/ConsentModal.tsx`
- Add new prop: `eventLocation?: string`
- Fix "esta" accent in "Terminos de la cesion" table row (line 210): change "esta" to "esta" (remove tilde from "esta")
- Update final paragraph (line 221): change "al sacar" to "al haber sacado" and append location info: "en {eventLocation}"

### File: `src/pages/events/EventRegistrationPage.tsx`
- Construct location string from event fields: `${event.location_name}, ${event.location_address}, ${event.location_city}`
- Pass it as `eventLocation` prop to `<ConsentModal />`

### File: `src/pages/consent/ConsentPage.tsx`
- Add `useEffect` + `useState` to fetch event info on mount via the new edge function when `consentToken` is available
- Replace the simplified consent text section (lines 280-305) with the full legal text including:
  - Two RGPD tables (matching ConsentModal structure)
  - Dynamic event name, date, and location from the fetched data
  - Participant info header
- Show a loading state while fetching event info
- Handle error state if token is invalid

### New file: `supabase/functions/get-consent-info/index.ts`
- Accepts POST with `{ consent_token: string }`
- Uses service role client to query `event_registrations` by `consent_token`, joining `events` for name, date, location fields
- Returns `{ event_name, event_date, event_location_name, event_location_address, event_location_city, participant_name, participant_age? }` or `{ error: "not_found" }`
- Applies the same CORS whitelist as other edge functions
- Does NOT require authentication (public endpoint for parents/guardians)

### Shared consent text
To avoid duplication between ConsentModal and ConsentPage, a shared React component `ConsentLegalText` will be extracted with the full legal text, accepting dynamic props for event name, date, location, participant name, and age. Both ConsentModal and ConsentPage will import and render this component.

## Execution Order
1. Create `supabase/functions/get-consent-info/index.ts` and deploy
2. Create shared component `src/components/events/ConsentLegalText.tsx`
3. Update `ConsentModal.tsx` to use shared component, add `eventLocation` prop
4. Update `EventRegistrationPage.tsx` to pass `eventLocation`
5. Update `ConsentPage.tsx` to fetch event info and use shared component
