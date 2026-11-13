# Secure Notes security review

Scope: current secure-notes source, local schema, automated tests and the explicitly
listed checks below. SPEC-secure-notes.md remains missing, so full compliance with
that document cannot be certified. This review follows the user's security checklist.
No application code, policies, SQL schema or remote records were changed.

## Findings and evidence

No confirmed cross-user authorisation bypass was found in the reviewed source.
This is not a statement that the deployed app has passed a penetration test.

| Area | Repository evidence | Verification limit |
| --- | --- | --- |
| RLS | db/schema.sql enables RLS on public.notes and creates exactly four policies for authenticated | Actual database configuration was not inspected through an administrative connection |
| Ownership | SELECT/DELETE USING, INSERT WITH CHECK, UPDATE USING and WITH CHECK all use user_id = auth.uid() | Extra deployed permissive policies could weaken the intended rules |
| Sensitive actions | createNote and the shared update/delete helper call getUser(), reject anonymous/invalid users and use lib/supabase/server.ts | Action tests mock Auth/PostgreSQL; live tampered requests remain untested |
| Owner assignment | INSERT allows only title/body; UPDATE allows title/body and a server timestamp; browser user_id is ignored | RLS must also hold for direct Data API calls, which bypass application validation |
| Edit read | app/notes/[id]/page.tsx calls requireUser, validates UUID, reads by ID with a scoped client and calls notFound on no row | Tests verify the no-row branch, not live owner/foreign-user database behaviour |
| Mutation targeting | .eq('id', noteId) targets one UUID; .select('id').maybeSingle() distinguishes affected rows from zero rows | An ID filter is not an ownership check; PostgreSQL RLS is the authorisation layer |
| Private caching | Home/edit/login are force-dynamic; server fetches use no-store; Cache Components disabled; Proxy sets private/no-store on matched HTML/RSC/actions/callbacks | Hosting/CDN behaviour and browser history require end-to-end checks |
| Logout | signOut(scope: local), cookie updates, root layout revalidation and fixed login redirect | Other devices remain signed in by design; actual back/forward/multi-tab tests were not run |
| Browser privacy | PrivateContent starts hidden, verifies same user ID, hides on pagehide/visibility changes and reloads restored history pages; dialogs close when hidden | UI safeguards do not replace server authorisation or erase already received data |
| Validation/rendering | String/type/length/blank-title checks, UUID validation, React text rendering and whitespace-pre-wrap; no dangerouslySetInnerHTML | App length limits are not database constraints; direct API clients can bypass app limits |
| Credentials | Only public URL/publishable-key variables are consumed by app clients; per-request server client; no privileged SQL client/RPC/raw SQL in app source | Targeted scan is not an exhaustive scan of Git history, build artifacts, external logs or hosting environment |

Login and signup establish identity and cannot require an existing session. Logout
is safe and idempotent for an expired session; it does not read or mutate notes.
Every note-reading page and note mutation checks authenticated identity. Proxy is
an additional checkpoint, not the sole security boundary. Next.js's built-in
Server Action POST/origin checks remain enabled; no cross-origin relaxation was found.

### Live check actually executed

A single GET /rest/v1/notes?select=id&limit=1 with the publishable key and no user
session returned HTTP 401 with permission-denied code 42501. No note IDs or content
were printed. This establishes denied anonymous SELECT for this endpoint at the
time of the check. It does not establish RLS enablement, all policy clauses, or
cross-user UPDATE/DELETE protection. No authenticated remote mutations were run.

### Credential scan actually executed

A targeted scan of 40 app text files (including local environment configuration,
excluding node_modules, .next, .git and .vercel) found no secret-key, service-role
JWT, private-key or password-in-PostgreSQL-URI patterns. The configured key has a
publishable prefix, not a secret prefix. No values were printed. Git check-ignore
confirmed .env.local is excluded; git ls-files showed it is not tracked. Public keys
identify the project; their presence is not proof that a request is authenticated.

### Remaining limitations and minimal recommendations

1. **Deployed-policy evidence is missing.** Do the read-only catalog inspection
   below before declaring live ownership enforcement verified. If mismatches are
   found, prepare a narrow reviewed migration; do not rerun the creation script
   blindly or weaken policies to make a test pass.
2. **Browser logout/history behaviour is unverified.** Run the two-account and
   multi-tab tests below. Do not treat no-store headers or hidden DOM as evidence
   that every browser/CDN has passed. No new application fix is justified without
   reproducing a failure.
3. **Validation boundary limitation:** the code safely checks FormData field values,
   but assumes the action argument itself is FormData. A deliberately malformed
   direct action call can throw rather than return a field error. Authentication
   runs first, so no unauthenticated mutation bypass was found. Optional minimal
   robustness fix: check the argument type before .get(); this is not an RLS fix.
4. **Direct API rules differ from application-only rules.** Blank titles are checked
   in both layers. The 200/20,000-character limits and timestamp maintenance are
   application rules only. Owners have table-level UPDATE permission and can change
   their own timestamps/IDs through direct API requests while satisfying RLS. If
   immutable IDs/audit timestamps or universal length limits become requirements,
   use narrow database grants/constraints/triggers in a separate reviewed change.
   No cross-user access follows from this alone, and timestamps are not audit logs.
5. No application code fix was made: the audit did not confirm an exploitable
   cross-user flaw. Do not add owner filters as a substitute for verifying RLS,
   use service credentials, disable email verification or introduce new features.

## Read-only deployed database verification

In the intended development project's Supabase SQL Editor, review then run these
read-only statements. They inspect metadata, not student notes. The editor's usual
administrator role can bypass RLS, so a SELECT * there is not an isolation test.

```sql
SELECT n.nspname AS schema_name, c.relname, c.relrowsecurity,
       c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'notes' AND c.relkind IN ('r', 'p');

SELECT policyname, permissive, roles, cmd, qual AS using_expression,
       with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notes'
ORDER BY cmd, policyname;

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notes'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid = 'public.notes'::regclass;

SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
WHERE rolname IN ('anon', 'authenticated');

SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'notes'
ORDER BY grantee, privilege_type;
```

Expected: relrowsecurity=true. relforcerowsecurity need not be true for API roles
that are neither table owners nor BYPASSRLS/superuser roles. anon/authenticated must
not be table owners and must not have those bypass privileges. Expect exactly four
authenticated policies with these expressions (PostgreSQL may add parentheses):

| Command | USING | WITH CHECK |
| --- | --- | --- |
| SELECT | user_id = auth.uid() | — |
| INSERT | — | user_id = auth.uid() |
| UPDATE | user_id = auth.uid() | user_id = auth.uid() |
| DELETE | user_id = auth.uid() | — |

Inspect ALL rows, including FOR ALL and policies applying to PUBLIC or anon. Extra
permissive policies combine with OR and can open access even when these four look
correct. Confirm user_id is non-null UUID, defaults to auth.uid(), references
auth.users(id), and title has NOT NULL/nonblank checks. Expect only the intended
SELECT/INSERT/UPDATE/DELETE grants for authenticated; no TRUNCATE grant and no
anonymous table grants. Policy checks and table privileges are distinct gates.

## Two-account security tests using fictional notes

Use a development project, two accounts A/B in separate browser profiles, and only
fictional notes such as "A security test" / "Fictional lesson plan". Record their
note IDs locally, not their credentials or tokens. Do not use real pupil records.

1. **Baseline:** each account creates a note, refreshes and sees its own record.
   A must not see B's list entries, and B must not see A's. Verify both directions.
2. **BOLA/IDOR read:** while signed in as B, paste A's /notes/[id] URL. Expect
   Not Found and no A title/body in HTML, React Server Component data or the UI.
   A random valid UUID should look the same. Signed-out access redirects to login.
3. **Tampered UPDATE:** start from B's own edit form. Using local browser request
   editing/interception, change only the submitted note ID to A's ID, preserving
   B's session. Submit a fictional replacement title/body. Expect unavailable or
   rejection, not Changes saved. In A's profile refresh and verify no field changed.
4. **Tampered DELETE:** use B's own delete confirmation request, change its note ID
   to A's ID but keep B's session and the confirmation marker. Expect no successful
   deletion. Refresh A's list/editor to prove its record is still present. Repeat
   steps 2–4 with A/B reversed. Missing buttons alone are not a passed test.
5. **Ownership forgery:** add user_id=A to B's create/update form. The app should
   ignore that field. A created record must belong only to B; an edit must never
   transfer ownership. Separately test the database directly with the signed-in
   user-scoped Supabase client (no service key): B inserting under A's user_id must
   fail WITH CHECK; B changing a B-owned note's user_id to A must also fail. Keep
   tokens in the local client only, not pasted into chat, screenshots or saved files.
6. **Validation/XSS:** whitespace-only title must fail without creating/updating a
   record. Try literal <script>alert(1)</script> and a multiline body: markup should
   display as text without executing, and line breaks should remain. A SQL-looking
   string must be stored only as text. Uploaded file values and malformed IDs must
   be rejected. Test direct submissions as well as HTML required-field checks.
7. **Logout:** open the list and editor, then sign out. Refresh, direct URL, Back and
   Forward must not reveal content. Repeat in a second open tab, including an open
   delete dialog, and switch back to the tab after logout. Log in as B in the same
   browser: A's previous content must not reappear. Test normal browser settings,
   not just DevTools' Disable cache mode, and inspect private/no-store headers on
   HTML, RSC and redirects. Do not export requests containing cookies or tokens.
8. **Failed logout/network:** observe the app's logout failure message when Auth is
   unavailable; it must not pretend successful signout. Verify actual session state
   after restoring connectivity. A lost response does not prove an operation failed.
9. **Record results:** write actual versus expected results for each direction and
   operation. Only then mark it passed. Clean up your fictional notes through the app.

## Concepts and scope limits

Authentication proves who the caller is (verified Supabase user/session).
Authorisation decides which rows they can use (PostgreSQL RLS). BOLA, also called
IDOR, means object-level authorisation fails when a caller swaps an ID for another
user's record. UUIDs reduce guessing but do not grant or deny access. .eq('id', id)
is merely record targeting. Client UI visibility and confirmation are usability
controls; the server and database must reject tampered requests independently.

Defence in depth combines action authentication, input/column allowlists, RLS,
safe rendering and private-response handling. None alone proves the other layers.
React escaping protects this display from HTML injection; it does not make strings
safe in arbitrary future SQL/HTML contexts. Supabase query-builder values are not
concatenated into raw SQL in this app.

Logout clears this browser session and refresh tokens, not other devices (local
scope). Copied access JWTs may remain usable at the direct API until expiry; do not
promise instant token revocation from cookie deletion or basic RLS. Already viewed
information, screenshots and saved responses cannot be erased by logout. The
current getUser checks and browser guards strengthen page handling, but actual
browser behaviour still needs the tests above. Sensitive session cookies are
browser-readable for the SSR client; SameSite=Lax and production Secure are set.
This makes avoiding XSS especially important. No dependency-advisory scan, full Git
history scan, hosting/CDN audit or comprehensive penetration test was performed.

## Executed checks

- Lint, standalone TypeScript and production build passed.
- 14 note-action/page tests and 5 authentication-validation tests passed. These
  mock database/Auth boundaries and cannot certify deployed RLS.
- 4 production HTTP smoke tests passed: signed-out HTML/RSC redirects, login
  no-store/error handling, invalid-login POST and safe callback failure.
- Node emitted the existing module-type detection warning for the auth validator;
  there were no failed tests or build/type/lint errors.
- The anonymous Supabase API read was denied as described above.
- No browser, authenticated cross-user mutation or database-catalog inspection
  tests were executed. No real note was created, changed or deleted by this audit.
- The temporary production server was stopped after testing.

Only SECURITY-REVIEW.md was added. All application and database code is unchanged.

References:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/signout
- https://nextjs.org/docs/app/guides/authentication
