# Secure Notes final acceptance audit

## Release conclusion and missing specification

**Not ready for an unconditional client-acceptance sign-off.** The application has
substantial implementation and automated evidence, but the formal specification,
deployed RLS catalog, authenticated browser acceptance record and public Vercel URL
are not available to this audit.

SPEC-secure-notes.md was searched for in the repository, excluding dependencies,
generated output and Git internals, and was not found. Its exact eight client
criteria and six feature headings cannot be quoted or certified. The eight groups
below are a **provisional organisation of the user's audit checklist**, not invented
verbatim client criteria. Features 1–4 were explicitly named in earlier requests;
Features 5–6 remain unknown until the specification is supplied.

## Evidence classifications

- **Code inspected:** present in source; does not prove deployed settings or browser behaviour.
- **Automated/mock tested:** real action/page/clock code exercised with mocked
  Auth, database or framework boundaries; cannot establish live RLS or persistence.
- **HTTP tested:** unauthenticated requests to the local production build, without
  a browser session. These do not run browser JavaScript or log in as a tutor.
- **Browser fixture tested:** actual presentation rendered in isolated Chrome using
  fictional notes and mocked auth/client hooks. These are layout checks, not live CRUD.
- **Live Supabase checked:** only public Auth settings and anonymous notes-read denial.
- **User reported:** the user stated authentication, CRUD and two-account list
  isolation worked. There is no independent per-criterion client test record here.
- **Not tested:** authenticated real-browser signup/login, direct cross-account
  tampering, persistence across real sessions, actual multi-tab timeout/history,
  Vercel availability and live client acceptance have not been executed by this audit.

## Eight provisional acceptance groups

All paths below are relative to secure-notes. Line references identify current
implementation entry points; function names are included for maintainability.

| Group / acceptance requirement | Implemented in code? | Exact evidence | Actually tested? | Remaining work / status |
| --- | --- | --- | --- | --- |
| A. Email/password signup and login, minimum eight characters, generic failed login | Signup: yes. Valid email syntax, string types and password >=8 checked server-side. Login intentionally accepts passwords >=1 for legacy accounts. Every returned credential error maps to exactly `Wrong email or password`. | `lib/supabase/validation.ts:1` `readCredentials()`, minimum at line 8; `app/login/actions.ts:12` `logIn()`, line 24 `signUp()`; `app/login/page.tsx:10` message map. | Five auth-validation unit tests cover signup limits/types and the deliberate short-login behaviour. HTTP tests cover an invalid login POST and exact generic message; they do not send a real wrong password. Live settings show signup enabled, email enabled, confirmation required. Minimum project password policy was not exposed. | Confirm whether the missing criterion requires eight for signup only or login too. If both, validator/test changes are needed; do not call that a confirmed mismatch before reading it. Test real confirmation, correct login, unknown email and wrong password. **Needs Testing / spec clarification.** |
| B. Unauthenticated users redirected from every protected route; current email and newest-first list at / | Yes for the existing private routes `/` and `/notes/[id]`. `/login` and `/auth/callback` are intentionally public. No extra /dashboard route is required. | `lib/supabase/auth.ts:7` `requireUser()`; `lib/supabase/proxy.ts:5` `updateSession()` and `proxy.ts` matcher; `app/page.tsx` `Home()` calls requireUser and orders created_at descending; `app/components/dashboard-header.tsx:7` `DashboardHeader({email})`; `app/notes/[id]/page.tsx:13` `EditNotePage()`. | Local production HTTP tests exercise signed-out HTML/RSC requests to both private routes. Home-page tests verify header email, form inclusion and descending order with fictional data. A successful-login action test verifies redirect to exactly `/`. | Test with real logged-in accounts and expired sessions; confirm production host/CDN serves the intended build. **Code/automated checks Passed; live acceptance Needs Testing.** |
| C. Create private persistent notes, reject blank title, preserve body line breaks safely | Yes. INSERT supplies title/body only, default owner is left to the DB. Title must contain non-whitespace; body can be empty. React text preview uses whitespace-pre-wrap, and editor textarea contains the full body. Draft clears only after success. | `app/actions.ts:9` `createNote()` authenticates, validates and INSERTs; `lib/notes-validation.ts:11` `validateNote()`; `db/schema.sql:7` owner default/FK and line 8 nonblank title constraint; `app/components/new-note-form.tsx` `NewNoteForm()`; `app/components/note-card.tsx:19`; `app/components/edit-note-form.tsx` `EditNoteForm()`. | Unit/action tests cover blank/missing/file/oversized fields, omitted body, unchanged plain text, owner-field allowlist and revalidation. A shared mock-store test verifies the next Home render includes a created card and updated counts. Layout fixture included literal script text and multiline text. Real persistence is user-reported, not independently tested here. | Save fictional multiline data, refresh, sign out/in and verify persistence. Test whitespace title with browser validation bypassed. Confirm literal HTML remains text. **Needs live Testing.** |
| D. Edit/delete own notes; foreign IDs reveal no content and cannot be changed | Yes, contingent on correctly deployed RLS. UUID validated; each action calls getUser; UPDATE/DELETE target `.eq('id', noteId)` and require an affected ID before success. Editor calls notFound for an RLS-hidden or missing row. Delete requires confirmation. | `app/actions.ts:62` `updateNote()`, line 66 `deleteNote()`, private `changeNote()` authenticates and checks affected rows; `lib/notes-validation.ts:6` `validateNoteId()`; `app/notes/[id]/page.tsx:13` `EditNotePage()` and line 21 notFound; `app/components/delete-note-button.tsx` `DeleteNoteButton()`. | Mocked tests cover unauthenticated calls, invalid IDs, missing confirmation, allowed columns, exact ID targeting, zero-row results, safe errors, editor prefill and Not Found branch. They do not execute a real A/B tampered request or real PostgreSQL policy. | Test A URL as B, tampered B UPDATE/DELETE using A ID, then inspect A's unchanged record. Reverse A/B. Test keyboard confirmation and stale/deleted tabs. **Needs live Testing.** |
| E. RLS enabled and four ownership policies enforced on deployed notes table | The script has exactly the required four policies. Deployed enablement/clauses are not established. | `db/schema.sql:17` ENABLE ROW LEVEL SECURITY; lines 22/26/30/35 SELECT/INSERT/UPDATE/DELETE policies; USING/WITH CHECK at 24/28/32/33/37 all compare user_id = auth.uid(); line 19 revokes default table grants; line 20 grants only intended CRUD to authenticated. | Source inspection confirms script content. Live anonymous API read returned 401/42501. That can be due to grants and is not proof of enabled RLS or four correct policies. No administrative catalog inspection or authenticated mutation policy test ran. | Run read-only catalog queries below. Check for extra permissive/FOR ALL policies, bypass roles and unintended grants. Execute two-account direct API ownership tests. **Needs Testing; release-critical.** |
| F. Logout, private caching/history and two-minute inactivity logout | Present. Local-scope SSR logout clears marker/revalidates layout; private responses are no-store; initial hidden UI and history/visibility guards exist. Idle limit exactly 120000ms, persisted deadline and storage-event coordination; successful login resets marker; background requests do not count as activity. | `app/login/actions.ts:52` `signOut()`, private `endSession()`, line 58 `expireIdleSession()`; `app/components/private-content.tsx:8`; `app/components/IdleTimeout.tsx:12`; `lib/idle-session.ts:1`, `IdleClock.start/check/activity/logout`; `lib/supabase/server.ts:8`; `lib/supabase/proxy.ts:43`; `next.config.ts:6`; inactivity message `app/login/page.tsx:37`. | Nine fake-time/storage tests cover expiry, activity, reload, suspension, tabs and writes; four mocked logout/login-marker tests cover local scope, stale marker and failure. HTTP tests cover no-store, signed-out redirects and inactivity message. No real two-minute session, logout/Back/Forward or offline browser test ran. | Execute browser checklist across both private pages and tabs. Client idle detection is not a server-maintained idle policy and cannot run while suspended. Copied access tokens can remain valid at a direct API until expiry. **Needs browser Testing.** |
| G. Professional responsive dashboard using real notes/statistics | Yes. White/sage layout; current account header, real exact count queries, rolling seven-day updated_at filter, protected cards and safe previews. Counts fail as unavailable, not fake zero. | `app/page.tsx` `Home()`; `app/components/dashboard-stats.tsx:3` `DashboardStats()`; `app/components/dashboard-header.tsx:7`; `app/components/note-card.tsx:7`; `app/globals.css`; `app/components/workspace-icon.tsx`. | Isolated Chrome fixture checks passed at 360/768/1440px, with one/two/three note columns, no horizontal overflow or visible controls under 44px; mobile empty state also tested. Screenshots inspected. Mocked count tests cover a card-list limit, updated_at window, query failure and create/edit/delete changes. | Live mobile/keyboard/screen-reader/hydration tests and per-account live count verification remain. Fixture checks do not establish authenticated operation. **Layout checks Passed; live UX Needs Testing.** |
| H. Public Vercel deployment and live client acceptance | Not established. A working local Next.js build exists, but no public URL or deployment record was provided, and `.vercel/project.json` is absent. Absence of local metadata is not proof no deployment exists. | `package.json` build/start scripts; Next.js production build; project folder `secure-notes`; `DASHBOARD.md`/this test record. The application directory currently appears untracked in the group repository. | No Vercel URL check, public signup/CRUD/browser history test or client sign-off ran. Root README links for other projects are not evidence for Secure Notes. | Supply the existing URL or perform an authorised deployment using the correct root/env/redirect settings; record production tests and client acceptance. Review source before a Git-based deployment. **Needs delivery work and Testing.** |

## Six implementation-feature audit

| Feature | Implemented? | Evidence | Tests actually completed | Remaining work |
| --- | --- | --- | --- | --- |
| Feature 1 — notes table and RLS (explicit earlier heading) | Yes in SQL source, deployed state unknown | `db/schema.sql` CREATE TABLE, index, RLS, four CREATE POLICY statements | Static inspection; anonymous read denied remotely | Catalog inspection and live ownership tests; no schema rerun without review |
| Feature 2 — authentication (explicit earlier heading) | Yes | `lib/supabase/client.ts`/`server.ts` `createClient`, `proxy.ts`, `requireUser`, `app/login/actions.ts`, `app/auth/callback/route.ts` GET | Input/action/HTTP tests; live public Auth settings read | Real signup confirmation, login failures, refresh and production callback tests |
| Feature 3 — My Notes and New Note (explicit earlier heading) | Yes | `Home`, `NewNoteForm`, `createNote`, `validateNote`; true Supabase SELECT/INSERT | Mocked input/insert/home/statistics tests; fixture layouts | Real persistence and per-account production list/count tests |
| Feature 4 — Edit and Delete Notes (explicit earlier heading) | Yes | `EditNotePage`, `EditNoteForm`, `DeleteNoteButton`, `updateNote`, `deleteNote`, `changeNote` | Mocked page/mutation tests | Real own-note CRUD, foreign URL and tampered UPDATE/DELETE tests |
| Feature 5 — exact specification heading unavailable | Cannot certify coverage | Missing SPEC-secure-notes.md | No exact feature-to-spec test mapping is possible | Provide the original heading and requirements, then map existing code/tests; do not invent another feature |
| Feature 6 — exact specification heading unavailable | Cannot certify coverage | Missing SPEC-secure-notes.md | No exact feature-to-spec test mapping is possible | Provide the original heading and requirements, then map existing code/tests |

Inactivity, responsive styling, statistics and deployment have been audited above
regardless of which formal feature number the missing specification assigns them.

## Supabase and credentials: observed versus unknown

The following read-only checks were executed during this audit, using the existing
publishable key and printing only flags/statuses, never credentials, IDs or bodies:

- GET Auth settings: HTTP 200, signup disabled=false, email enabled=true,
  email auto-confirm=false (confirmation required). No minimum-password field was
  exposed; the project's configured minimum cannot be inferred from this response.
- Anonymous notes GET (id only, limit 1): HTTP 401, code 42501, no row output.
- Targeted scan of 54 application text files found no secret-key, service-role JWT,
  private-key or password-bearing database-URI patterns. Generated dependencies,
  build artifacts, Git history and hosting logs were outside that scan.
- `.env.local` is Git-ignored and untracked. Public URL/publishable key are the app
  configuration inputs. No secret/service key was used to query notes.

**Minimal correction made:** `.env.example` was missing although setup docs refer
to it. It was restored with placeholder public variables only. The other added file
is this audit report. No working authentication, CRUD, timer or database policy was
changed. No live note was created, edited or deleted.

No confirmed cross-user bypass was found in source. That is not a penetration-test
pass. Signup's eight-character rule does not prove the direct Auth API enforces the
same project password policy. Existing browser guards do not prove every browser's
back/forward cache behaviour. Neither limitation should be hidden by a green badge.

## Required deployed-database evidence

Review these read-only statements in the correct development/project SQL Editor.
This audit has not executed them. Do not use the editor's privileged SELECT * on
notes as an RLS test: administrators can bypass row policies.

```sql
SELECT c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'notes';

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notes'
ORDER BY cmd, policyname;

SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'notes';

SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
WHERE rolname IN ('anon', 'authenticated');
```

Expect RLS true, four authenticated policies with the five ownership conditions
(UPDATE has two), and no extra permissive/PUBLIC/FOR ALL policy granting broader
access. anon/authenticated must not be table owners, superusers or BYPASSRLS roles.
Check intended CRUD grants and no TRUNCATE grant. Existing SECURITY-REVIEW.md has
additional read-only constraint/default inspections. Do not paste user records or
credentials into the audit results.

## Live two-account acceptance record to complete

Use separate profiles A and B, fictional notes, and a result log with environment,
date, browser, expected/actual outcome and tester. Do not record passwords/tokens.

1. Test invalid email and seven/eight-character signup passwords. Complete email
   confirmation in the signup browser. Test real wrong-password and unknown-email
   login: exact same generic error. Confirm success goes to `/`.
2. Signed out, visit `/` and a known `/notes/[id]` URL directly. Both must redirect.
   As A, confirm current email, newest-first notes and actual count values.
3. Create fictional multiline text, reject whitespace-only titles, store literal
   HTML/SQL-looking text safely, refresh and sign out/in. Verify persistence and
   that the stored body is not truncated by the card preview.
4. B must not see A's list/counts. Open A's edit URL as B: Not Found, no A content.
   Tamper B's UPDATE and confirmed DELETE request IDs to A's ID while retaining B's
   session. Expect no successful mutation; independently verify A's record is
   unchanged. Repeat in reverse. Also test direct user-scoped API ownership forgery
   against INSERT and UPDATE WITH CHECK, without a service key.
5. Edit/delete own fictional records and check list/count refresh immediately and
   after reload. Test stale-tab deletion, confirmation Cancel/Escape and failed requests.
6. Logout, refresh and Back/Forward on list/editor; repeat with two tabs and an open
   dialog. Sign in as the other account in the same browser and check stale content.
7. Idle exactly two minutes, then test continued activity, refresh, route changes,
   suspended tabs, cross-tab activity/logout and offline retry. Confirm the exact
   inactive login message. Background refresh alone must not renew the deadline.
8. Test phone/tablet/desktop widths, 200% zoom, keyboard and screen reader; inspect
   actual production console/network for hydration, failed POSTs and no-store.
9. Repeat on the public Vercel URL and obtain the client's recorded acceptance of
   all original eight criteria after the specification mapping is completed.

## Executed checks in this audit run

| Check | Result and limits |
| --- | --- |
| npm.cmd run lint | Passed |
| npx.cmd --no-install tsc --noEmit | Passed |
| npm.cmd run build | Passed; / and /notes/[id] remain dynamic routes |
| tests/notes.test.mjs | 20 passed; mocked notes/action/page/statistics boundaries |
| tests/idle.test.mjs | 9 passed; fake time and storage, not elapsed browser sessions |
| tests/idle-logout.test.mjs | 4 passed; mocked SSR Auth and marker handling |
| tests/auth-validation.test.mjs | 5 passed; includes deliberate short-password login behaviour |
| tests/auth-smoke.test.mjs | 5 passed against a fresh local production server on port 3120; unauthenticated HTTP only |
| Headless Chrome fixture | Passed at 360/768/1440px plus mobile empty state: one/two/three note columns, no horizontal overflow, no visible controls below 44px; desktop screenshot inspected |
| Live Supabase | Auth settings returned 200; anonymous notes read denied 401/42501; deployed policies not inspected |
| Live authenticated / public-client browser tests | Not run |

Total automated regression tests: **43 passed, zero failed**. Node emitted the
existing module-type detection warning while importing the TypeScript auth validator;
it did not affect tests. No credentials or private notes were used in fixture tests.
The temporary production server was stopped after checks; the user's development
server was not intentionally stopped or replaced.

## Final status table

| Status | Scope |
| --- | --- |
| Passed | Build/lint/types, 43 automated tests, isolated responsive fixtures, source inspection of intended policies/actions, anonymous read denial, ignored/untracked local secrets; missing safe template restored |
| Needs Testing | Real signup/login and minimum project policy; deployed RLS catalog; real persistence, A/B URL and mutation tampering, live statistics, logout/history/multi-tab idle, authenticated mobile/accessibility, public deployment and client sign-off |
| Needs Fixing | Missing original specification prevents exact eight-criterion/six-feature mapping. No additional confirmed application-code defect was established. If the original criterion demands >=8 on login as well as signup, the documented login minimum needs a narrowly scoped correction after clarification |

## Final delivery steps

1. Restore/provide SPEC-secure-notes.md, map its exact eight criteria/six features
   and resolve the signup-versus-login minimum-password wording.
2. Complete deployed RLS/password-policy inspection and the live A/B tests above.
3. Review and save the intended source in version control if using Git deployment.
   The app is currently shown as untracked; do not stage root node_modules or secrets.
4. With deployment authorised, select Next.js and Root Directory `secure-notes` in
   Vercel. Set the two NEXT_PUBLIC Supabase variables for Production before building.
   Use only the project URL and publishable key. No database/service-role secret is needed.
5. Configure the production HTTPS Site URL and exact `/auth/callback` redirect in
   Supabase. Verify email delivery/confirmation; do not disable confirmation to mask
   a setup error. Verify any deployment access protection permits the intended client.
6. Deploy/redeploy the reviewed build, test the public URL in a fresh browser, repeat
   the critical security/CRUD/idle/mobile tests, then send the verified link with the
   acceptance record. No deployment or public-availability claim was made by this audit.

Official delivery references:
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/environment-variables
- https://supabase.com/docs/guides/auth/redirect-urls
