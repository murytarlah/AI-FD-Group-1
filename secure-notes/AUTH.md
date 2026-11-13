# Feature 2: authentication

This records the authentication feature as originally implemented. Notes creation,
listing and interaction feedback have since been added; see INTERACTIONS.md for
current behaviour, investigation findings and the end-to-end checklist.

SPEC-secure-notes.md remains absent. Implementation follows the requested Feature 2
requirements and the installed Next.js 16.4.5 documentation. No SQL, Supabase project
configuration, library application, or database tables were changed.

## How it works

Authentication establishes identity. Supabase verifies the email/password and
issues session tokens. Authorisation decides which records that identity may use;
the notes RLS rules from Feature 1 enforce that in PostgreSQL. This feature does
not query notes or add create/edit/delete functionality.

- lib/supabase/config.ts reads only the two public environment variables. A missing
  or placeholder configuration gives a safe setup notice, not a broken login page.
- lib/supabase/client.ts creates the browser client. lib/supabase/server.ts creates
  a separate cookie-aware server client per request, avoiding shared user state.
  Both use @supabase/ssr, which wraps @supabase/supabase-js.
- Cookies carry the session between browser and server. Supabase manages cookie
  chunking and token rotation. The browser client must be able to read its session
  cookies, so these are not HttpOnly cookies. SameSite=Lax limits cross-site sending;
  Secure is enabled in production, which requires HTTPS outside local development.
  Tokens are sensitive even though the project URL and publishable key are public.
  Never copy tokens into logs, screenshots, error messages, or repository files.
- proxy.ts calls lib/supabase/proxy.ts for /, /login, /notes/* and /auth/*, including
  requests for React Server Component data and Server Action POSTs on these paths.
  getUser() validates with Supabase Auth and refreshes the session when necessary.
  Refreshed cookies update both the ongoing request and the browser response.
  Cookies and cache headers are preserved when redirecting to /login.
- lib/supabase/auth.ts verifies getUser() again on each protected page. Never trust
  a decoded cookie or getSession().user as proof of identity. The extra check is
  intentional: proxies and UI links are not the only entry points to server code.
  Future data actions must independently verify identity and retain database RLS.
  Anonymous Supabase Auth users are not accepted as email/password users here.
- app/login/actions.ts uses "use server": form submissions execute server-side
  over POST. Next.js applies its built-in Server Action origin checks. Validation
  rejects missing fields, uploaded files, invalid email syntax, and excessively
  large values. Signup requires at least eight password characters. Email is
  trimmed; password is not. Login does not impose signup's new-password minimum
  on existing accounts. Browser required/type checks improve usability, but only
  server-side validation can protect direct requests.
- Signup calls signUp(); login calls signInWithPassword(). All credential failures
  display exactly "Wrong email or password". Raw Supabase errors are never shown.
  Successful signup either receives a session or asks the user to check their email.
  The generic confirmation message does not identify registered accounts.
- app/auth/callback/route.ts exchanges the confirmation's PKCE code for a session.
  It redirects only to fixed local destinations, preventing an open-redirect input.
  A failed/expired link gets a generic message. Confirm in the same browser used
  for signup so the PKCE verifier cookie is available. If confirmation succeeded
  but the browser lost its verifier, return to /login and use email/password.
- signOut() ends the current session with scope: local; other devices are not
  deliberately logged out. It is safe to call even for an expired session and
  does not access protected records. An Auth failure is reported rather than
  claiming successful logout. Login/logout revalidate the root layout, and cookie
  writes invalidate Next.js's client router cache before redirecting.

## Private responses and browser history

The optional starter Cache Components mode is disabled. Both protected pages and
login are force-dynamic, Auth fetches use no-store, and proxy sends private,
no-store/no-cache headers on every matched response, including callback and
redirect responses. Do not add "use cache" or a shared cache around user content.

app/components/private-content.tsx initially hides private UI until the browser
also verifies the same user ID. It hides content before pagehide and when a tab
becomes hidden, reloads restored back/forward-cache snapshots, and rechecks identity
when the page becomes visible. Auth sign-out events redirect the browser to login.
This reduces stale content exposure through history and tabs. JavaScript is needed
to reveal protected UI. Server authentication remains the security boundary; a
browser guard cannot replace it. These controls cannot erase screenshots, saved
pages or information a user already legitimately received. There is no note content
in this feature. Real-session history behaviour still needs browser testing below.

The existing downloaded starter fonts were replaced by system fonts because Google
Fonts was unreachable in earlier builds. The Turbopack root now points at this app,
avoiding ambiguity from the repository's multiple package lockfiles. No dependency
changes were needed.

## Configure locally yourself

1. In secure-notes, copy .env.example to .env.local only if .env.local does not
   already exist. Fill in NEXT_PUBLIC_SUPABASE_URL and
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from your development project. Use no
   database password, secret key or service-role key. .env.local stays Git-ignored.
2. Check your Supabase Auth settings manually. Email/password signup must be
   available. Keep email confirmation enabled for the confirmation test. Under
   Authentication > URL Configuration, check the Site URL and allow the exact
   callback URL you will use, for example http://localhost:3000/auth/callback.
   The implementation did not change those settings. Stricter password rules,
   signup restrictions and email rate limits in your project still apply.
3. Run `npm.cmd run dev` inside secure-notes. Use the same host and port throughout
   signup and confirmation; localhost and 127.0.0.1 have different cookie stores.
   Restart after environment changes. Use a disposable test email, not pupil data.

## Manual acceptance tests

1. **Protected access:** in a fresh private window, visit / and /notes/test-id
   directly. Both must redirect to /login, with no email or note data in their
   responses. /notes/test-id is only a protected placeholder at this stage.
2. **Validation:** submit an invalid email or signup with a seven-character password.
   Signup must be rejected. Eight characters passes the app's minimum, though
   your project's password policy may be stricter. Test server validation with
   browser validation disabled as well.
3. **Signup:** use a new disposable email and a suitable password. Expect the generic
   check-email message. Open the confirmation link in the same browser; expect the
   home page showing that user's email. If email confirmation is disabled in the
   project, immediate login is expected instead. Do not change settings just to
   make an unexpected result pass.
4. **Login:** sign out, then log in with the confirmed account. Expect / and the
   correct email. Visit /notes/test-id: expect only a placeholder, no database read.
5. **Incorrect password:** use a wrong password for the confirmed account, then
   use an unknown email. Both must display exactly `Wrong email or password` and
   remain on /login. No Supabase error detail, password or token should appear.
6. **Logout/history:** sign out, then refresh, press Back/Forward, and open both
   protected URLs directly. Expect login and no restored private content. Repeat
   with a second tab, switching back to it after logout, and with a throttled
   network. In browser Network tools, inspect Cache-Control for HTML and RSC
   responses: private/no-store must be present. Do not export cookie headers.
7. **User isolation:** log in as A, sign out, then log in as B in the same browser.
   Back/Forward must never reveal A's email under B's session. Test a separate
   browser profile as well. No notes isolation test is implemented here; retain
   Feature 1's database policy tests for the later data feature.
8. **Refresh:** while logged in, reload after the access token expires normally.
   The proxy should refresh the cookies and keep the correct user signed in.
   A revoked/invalid session must redirect to login; do not paste or log tokens.
9. **Mobile/keyboard:** check the login form at a narrow viewport, tab through its
   labelled fields and buttons, and verify status messages are announced.

## Local checks

Run inside secure-notes:

```powershell
npm.cmd run lint
npx.cmd --no-install tsc --noEmit
node --experimental-strip-types --test tests/auth-validation.test.mjs
npm.cmd run build
```

For signed-out HTTP checks, run `npm.cmd run start -- --hostname 127.0.0.1 --port 3100`
after building, then in a second terminal run `node --test tests/auth-smoke.test.mjs`.
These checks cover HTML/RSC redirects, cache headers, invalid-login Server Action
POSTs and safe callback failure. They do not create users or query database tables.
Stop the server with Ctrl+C afterwards. AUTH_TEST_URL can select another local URL.

Lint checks framework rules; TypeScript checks types without emitting JavaScript;
the Node tests exercise hostile/missing validation input; build checks production
compilation. Node 24 can run this small TypeScript validation module directly and
may print a harmless module-type detection warning. No test sends real credentials
to Supabase. Full signup, confirmation, token refresh, and browser logout/history
tests require your configured development project and remain manual.

Official references:
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://nextjs.org/docs/app/guides/authentication
- https://nextjs.org/docs/app/api-reference/functions/cookies

The installed Next.js docs under node_modules/next/dist/docs were also consulted
for Proxy, Server Actions and request cookie handling.

## Verification results

- Final ESLint, standalone TypeScript and production build checks passed.
- Four validation tests and four production HTTP smoke tests passed.
- An initial lint failure for a plain home anchor was fixed with Next.js Link.
- The callback smoke test exposed a localhost/127.0.0.1 host mismatch in the
  original absolute redirect; relative redirects fixed it after rebuilding.
- Node printed a module-type detection warning for direct TypeScript test imports;
  it did not affect tests. No package-wide module setting was changed just for tests.
- .env.local was confirmed Git-ignored and untracked; it does not exist in this app.
- No configured Supabase accounts were available. Live signup/confirmation,
  correct/incorrect real-password login, token refresh, visual mobile checks and
  real-session logout/back/forward behaviour remain manual acceptance tests.
- Local test servers were stopped after verification.
