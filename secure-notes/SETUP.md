# Secure Notes: starter setup

Historical setup notes below describe the initial starter. Feature 2 now adds
authentication and replaces downloaded fonts with system fonts; see AUTH.md for
current setup, security decisions and acceptance tests. The root page now requires
a session, so an unconfigured app redirects to the login setup notice.

This existing Next.js application is being preserved. This stage prepares the
tooling only; authentication, database tables, Row-Level Security (RLS), and note
operations are not implemented. SPEC-secure-notes.md was not found in the repository.

## Run locally

From the group repository in PowerShell:

```powershell
cd secure-notes
npm.cmd ci
npm.cmd run dev
```

`cd` selects this application's folder. `npm.cmd ci` installs the exact versions
recorded in package-lock.json; use it after cloning or when dependencies are
missing. `npm.cmd run dev` starts the development server. Open the local URL printed
by Next.js (normally http://localhost:3000). Press Ctrl+C to stop it.
On shells without PowerShell's script restriction, `npm` works in place of `npm.cmd`.

The starter page runs without Supabase configuration. When a later feature needs
Supabase, copy .env.example to .env.local only if .env.local does not already exist,
then enter your project's URL and publishable key. Restart the server after edits.
The template is safe to commit; .env.local is ignored by Git. Values prefixed with
NEXT_PUBLIC_ are visible to the browser. Never use a database password, secret key,
or service-role key in these variables.

## What the files and dependencies do

- app/page.tsx: the existing home page.
- app/layout.tsx: the shared HTML layout, metadata, and font setup.
- app/globals.css: global styling and the Tailwind import.
- next.config.ts: existing Next.js and Tailwind Turbopack integration.
- tsconfig.json: TypeScript settings, including strict type checking.
- eslint.config.mjs: code quality rules.
- package.json: commands and dependencies for this application.
- package-lock.json: exact dependency versions for reproducible installs.
- .gitignore: excludes installed packages, generated output, and local environment files.
- .env.example: documents the two public Supabase settings using placeholders.

Next.js supplies routing and development/build tools. React and react-dom render
the interface. TypeScript catches type mistakes; the @types packages describe Node
and React APIs. Tailwind CSS provides styling classes, and @tailwindcss/turbopack
integrates it with this starter's bundler. ESLint and eslint-config-next check code
against Next.js rules. @supabase/supabase-js is the Supabase API client;
@supabase/ssr supplies browser/server client and cookie helpers for future auth work.
No direct PostgreSQL driver is needed for this stage.

## Verification commands

```powershell
npm.cmd run lint
npm.cmd run build
npx.cmd tsc --noEmit
git check-ignore -v .env.local
```

Lint checks code quality. Build compiles a production version and checks types.
The TypeScript command checks types without producing JavaScript files.
git check-ignore reports which rule keeps .env.local out of Git.
`npm.cmd start` serves the production build after a successful build.

The existing starter downloads Google fonts during compilation, so the initial
development compilation and production build may require network access.

## Results of this setup check

- Development server: started on 127.0.0.1:3100; GET / returned HTTP 200
  with the existing starter page.
- ESLint and TypeScript checks passed.
- Production build failed because Google Fonts could not be reached to fetch
  Geist and Geist Mono. The existing font configuration was preserved.
- Next.js warned that multiple package lockfiles make its inferred workspace
  root ambiguous. No root lockfiles or other applications were changed.
- Git confirmed .env.local is ignored and untracked, while .env.example is allowed.
- PowerShell blocked npm.ps1; npm.cmd worked without a policy change.
- Restricted-network and offline dependency installs could not finish. An
  installation with network access succeeded using the same Supabase versions
  already present in the repository root (2.119.0 and 0.12.7).
