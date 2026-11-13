# Secure Notes: Vercel deployment and production tests

This is the existing Next.js app in the group's secure-notes directory. Do not
import library or select the repository root as the application root. Authentication,
CRUD, RLS and the two-minute browser idle logout remain unchanged.

## Deployment explained

Localhost runs on your computer and is not a public client URL. Deployment uploads
or checks out a reviewed version, installs its dependencies and builds it on a
hosting service. Vercel supports Next.js static assets, dynamic server rendering,
Route Handlers, Proxy and Server Actions; a successful local build is preparation,
not proof that the public deployment works.

Environment variables supply configuration without putting each environment's
values in source files. .env.local configures your local app; it is not automatically
copied into Vercel's environment. NEXT_PUBLIC values are bundled for the browser and
are public. The publishable key identifies the project; the user's signed-in session
provides identity. RLS decides which records that identity may access. A public app
must keep RLS because visitors can send API requests without using its buttons.

## Source and repository preparation

Run inside secure-notes:

```powershell
npm.cmd run lint
npx.cmd --no-install tsc --noEmit
npm.cmd run build
```

These check code rules, TypeScript types and a production compilation. Use npm.cmd
on this machine because PowerShell blocks npm.ps1. .env.local, node_modules and
.next must not be committed. .env.example is a safe placeholder template. The new
.vercelignore additionally excludes local environment files from direct CLI uploads.

The deployment branch must include the secure-notes source. If the group production
branch does not contain it, use a reviewed pull request; do not push over other
members' work or merge without their normal review. Git-based Vercel import only
sees pushed commits, never untracked local source. Inspect staged filenames before
committing and never run git add . from this multi-project repository.

## Import the group repository in Vercel

The prepared source is pushed on `secure-notes-vercel`:
https://github.com/murytarlah/AI-FD-Group-1/tree/secure-notes-vercel

At preparation time main contains only the group README, so importing main before
the folder exists there cannot build this app. The simplest group workflow is to
review/merge this branch's PR first, then import main. An alternative is to use this
branch deliberately as the Vercel project's Production branch. No merge was performed.

1. Sign in to Vercel and choose the intended personal/team account. Select
   Add New > Project, connect GitHub and import murytarlah/AI-FD-Group-1. Grant only
   the repository access required by your group. Existing Library deployments stay
   separate projects and must not be edited.
2. Choose a distinct project name, such as secure-notes if available. Framework:
   **Next.js**. Root Directory: **secure-notes**, not ./ and not library.
3. Keep the Next.js build/output defaults: npm run build and Next.js-managed output
   (.next). Do not configure a static export or a custom static output folder.
   npm ci can install the committed package-lock.json reproducibly.
4. Confirm which pushed branch will be deployed. Vercel normally selects the Git
   repository's production branch; a different deployment branch can be a Preview
   until reviewed/merged or deliberately selected under Settings > Environments >
   Production > Branch Tracking. For a branch-only release, select secure-notes-vercel
   there, then use Deployments > Create Deployment with that branch name or URL.
   Do not assume a deployment-branch commit has appeared on main automatically.
5. Add the variables below before the initial deployment. Use Production for the
   public app. Configure Preview too only if you intend to test preview branches;
   preferably use a separate development Supabase project for previews.
6. Deploy and wait for Ready. Inspect build logs if it fails. From the project's
   Overview/Deployments page choose Visit. The stable production domain is also
   listed under Settings > Domains. Do not mistake localhost, a protected preview,
   or a Library URL for the production client URL.

## Supabase environment variables

Open the intended Supabase project's Connect dialog, or Settings > API Keys/API
configuration. Copy the project URL and **publishable** key into Vercel's environment
variable fields locally; do not paste them into chat or screenshots.

| Variable | Value source |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Project URL from that Supabase project |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable API key from the same project |

Never use a secret key, service-role key, database connection string or database
password. Do not upload .env.local. A publishable key is designed for browser use;
its safety depends on correct RLS, not on hiding it. Redeploy after changing these
variables: public Next.js configuration is incorporated during the build.

## Supabase Auth production domain

After you know the stable production domain, open Authentication > URL Configuration
in the correct Supabase project:

- Site URL: https://YOUR-PRODUCTION-DOMAIN
- Add the exact permitted redirect: https://YOUR-PRODUCTION-DOMAIN/auth/callback
- Retain http://localhost:3000/auth/callback if that is your development origin.
  Add another exact local callback only if you actually use that hostname/port.
- Add a custom domain's exact callback too if used. Avoid broad production wildcard
  redirects; deliberately allow previews only when needed.

The app's signup action builds /auth/callback from the validated Server Action
Origin. The callback exchanges the PKCE code, sets SSR cookies and redirects to /.
Confirm emails in the same browser used for signup so the verifier cookie exists.
The app's login redirects to /, manual logout to /login?message=signed-out and idle
logout to /login?reason=inactive. These are local paths and keep the deployed origin.

Keep email confirmation enabled and check the email provider/SMTP limits. If email
delivery fails, inspect Supabase Auth logs and the app's safe error message; do not
disable confirmation or weaken RLS to mask configuration problems. The public Auth
settings endpoint does not establish the deployed table's RLS policy clauses.

## Production verification record

Record actual outcomes with date, public URL, deployed commit, browser/device and
tester. The following tests are **not passed simply because the app built locally**.
No production login, note mutation or real idle session has been tested unless a
result is recorded against the actual public domain.

| Test | Procedure / expected result | Live result |
| --- | --- | --- |
| Public access | Open stable HTTPS domain in a fresh private browser without a Vercel account; intended client must be able to reach login | Not run |
| Registration | Use a disposable tutor email and >=8-character password, confirm the email in the same browser, then reach / | Not run |
| Login failures | Wrong password and unknown email both display exactly Wrong email or password | Not run |
| Tutor A creation | Create a fictional multiline lesson note; see it newest-first and actual statistics update without refresh | Not run |
| Persistence | Refresh, close/reopen the site and sign out/in; the saved record and full multiline text remain | Not run |
| Edit | Change title/body, save and verify after refresh; blank title must fail and preserve draft | Not run |
| Delete | Cancel first, then confirm permanent deletion of a disposable note; refresh and confirm absence | Not run |
| Tutor B isolation | In a separate profile, B's list/counts exclude A's notes and vice versa | Not run |
| Foreign URL | Copy A's /notes/[id] URL into B's profile; Not Found, no A content | Not run |
| Tampered mutations | Retain B's session but target A's ID in UPDATE/DELETE; reject/no affected row, and A's record remains unchanged; repeat in reverse | Not run |
| Signed-out routes | Direct / and /notes/[id] requests redirect to /login | Not run |
| Manual logout/history | Logout from list/editor with another tab open; refresh/Back/Forward must not reveal private notes | Not run |
| Two-minute idle | No input for 120000ms: hide notes, sign out and display exact inactivity message; activity renews deadline | Not run |
| Refresh/suspension/tabs | Expired timer must survive reload; returning from hidden/suspended tab locks immediately; activity/logout coordinates same-origin tabs | Not run |
| Slow/offline requests | Safe failure/loading feedback; idle signout failure keeps notes hidden with retry, not a false success | Not run |
| Mobile | Check narrow viewport, no horizontal overflow, accessible controls; also open the HTTPS link on a real phone | Not run |
| Client acceptance | Client repeats agreed criteria and records sign-off against stable production link | Not run |

For direct account tests, create A/B through the normal UI, not through admin or
service-role credentials. Do not share their passwords, cookies or tokens in chat.
Use fictional notes and clean them up through the app after verification. A stopped
or offline browser cannot execute client logout; it checks elapsed time on resume.
This timer is not a separate server-enforced session lifetime policy.

Unauthenticated HTTP checks can be run from secure-notes after the URL exists:

```powershell
$env:AUTH_TEST_URL = 'https://YOUR-PRODUCTION-DOMAIN'
node --test tests/auth-smoke.test.mjs
```

They verify redirects, cache headers, invalid-login submission and inactivity notice;
they do not log in, test RLS or prove CRUD persistence. Check actual HTML/RSC headers
and console errors in the browser without exporting sensitive request headers.

Chrome/Edge DevTools device emulation checks widths, not a real touchscreen browser.
For the real-phone check, open the same stable public HTTPS URL in Safari/Chrome,
log in to a disposable account and repeat save/edit/delete/scroll/keyboard/logout.
Localhost on the phone refers to the phone, not your development computer.

## Current preparation state

Local lint, TypeScript and production build passed during this deployment task.
The app consumes exactly the two public Supabase variables above. No .env.local is
tracked. A targeted candidate-source credential scan found no secret/service-role
patterns; it is not an exhaustive scan of all past Git history or external logs.
No public Vercel deployment or production-domain Supabase change is claimed by this
document. Update the live-results column only after actually executing each test.
All 43 local automated regression tests passed during preparation, including five
HTTP checks against a temporary local production server. No live browser tests
were performed. Vercel account access must be installed/connected or the dashboard
steps completed by the project owner before a production URL can be obtained.

Official references:
- https://vercel.com/docs/git
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/environment-variables
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth/redirect-urls
