# Interaction investigation and repairs

## Findings before changing code

- Login, signup and logout were connected to real Server Actions, not dummy buttons.
- No app/actions.ts, note form, INSERT or SELECT existed. The home page explicitly
  said notes would be added later. There was no note persistence implementation.
- This checkout has no .env.local. Only .env.example is present. Without public
  Supabase configuration the existing login page deliberately disables its buttons.
  Styling cannot fix that. The notes schema script exists, but its remote application
  is unverified; no database connection or SQL execution was attempted.
- The form buttons had no pending feedback. The private-content guard initially
  hid the entire page while checking Auth, without a visible progress message.
  Its auth callback used queueMicrotask for another Auth call. This was a lock-order
  risk, not a reproduced live-session deadlock; setTimeout now defers it to a later
  event-loop task. Real-session/browser verification remains necessary.
- No missing auth imports were found. No browser hydration error has been reproduced.
  SPEC-secure-notes.md is still absent. Changes follow the requested interactions.

## How interactions now work

The home page authenticates on the server and SELECTs id, title, body and created_at
from notes, ordered by created_at descending. It adds no owner filter: RLS chooses
which rows the session may read. Failed loading is distinct from an empty list.
Each body is rendered as React text with whitespace-pre-wrap, so line breaks remain
and HTML/script text cannot become executable markup.

NewNoteForm uses React useActionState to invoke app/actions.ts over a Server Action
POST. The action independently calls getUser(), rejects anonymous/invalid sessions,
and validates FormData. Fields can be strings, files or missing; the validator checks
types before trimming. A title must contain non-whitespace text. An omitted body
becomes empty text; a file body is rejected. The app limits titles to 200 characters
and bodies to 20,000. Browser limits aid usability; server limits enforce the rule.

INSERT sends only title and body. Even if an attacker adds user_id to the form, it
is ignored. PostgreSQL assigns auth.uid() from the verified request's session, and
the INSERT RLS policy checks ownership. The public publishable key is not itself a
user identity. No service-role credential or privileged bypass is used.

During saving, fields/buttons are disabled and the button says Saving. Errors keep
the controlled draft intact; success clears it and announces Note saved. After a
successful INSERT, revalidatePath('/') causes the home page to rerun its SELECT and
return an updated list. The list is not an in-memory substitute for persistence:
refresh reads it again from PostgreSQL. This behaviour is implemented but cannot be
confirmed against your real database until the project is configured.

Login/signup retain their real Server Actions and generic login error. A shared
useFormStatus button gives pending feedback and prevents repeated clicks while a
submission runs. Logout retains its existing session-clearing action. Unhandled
render/action failures get a safe retry screen without raw database error details.
The privacy guard shows Checking your session rather than an unexplained blank
page. Existing server checks, per-request clients, private/no-store responses,
dynamic rendering and history revalidation remain intact.

No edit/delete/share controls were added. The /notes/[id] page remains explicitly
labelled as an unimplemented viewing placeholder; the list does not link to it.
The library application, SQL script, dependencies and Supabase project were untouched.

## Configure and test

1. In secure-notes, create .env.local from .env.example only if it does not already
   exist. Enter your development project's NEXT_PUBLIC_SUPABASE_URL and
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY locally. Never enter secret/service-role
   keys or database passwords, and do not send session tokens in bug reports.
2. Confirm public.notes and its four RLS policies were applied to that project.
   Use db/README.md's read-only checks; do not blindly rerun schema.sql against an
   existing table. I have not applied or verified the remote schema.
3. Run npm.cmd run dev inside secure-notes; open the printed URL. Restart after
   environment edits. Check the callback allowlist described in AUTH.md. Use one
   consistent hostname throughout signup and confirmation.
4. Sign up with a disposable address and an eight-character-or-longer password.
   Confirm its email when required. Log in; expect your email and My Notes.
   Invalid signup should explain validation; wrong password/unknown email should
   both say exactly Wrong email or password. Watch the pending button feedback.
5. In a fresh account expect No notes yet. Submit a title made only of spaces:
   expect a validation error and no new note. Try empty title with browser validation
   disabled as well. Test an empty body; that is allowed.
6. Enter a title and a multiline body including literal <script>alert(1)</script>.
   Create the note. Expect Saving, then Note saved, a cleared form and the note at
   the top. Script markup must display as text. Refresh: the same note must remain.
   Create a second note and verify newest-first ordering.
7. In a development project, simulate a service/network failure with browser offline
   mode or request blocking. Expect a safe error/retry screen, not SQL details.
   On an INSERT response error, the draft must remain and no success be announced.
   If INSERT succeeded but SELECT fails, the page must show a load error rather
   than claiming the list is empty. Restore connectivity before retrying; a lost
   response can leave an uncertain outcome, so check the list before resubmitting.
8. Sign out. Refresh and Back/Forward must not reveal notes. Open / and /notes/test
   in a private window: both must redirect to login. Repeat with two tabs.
9. Log in as a second disposable user. They must not see the first user's notes.
   Sign out/in again in the same browser and repeat history navigation. Real RLS
   isolation must be tested against your database, not just mocked client tests.
10. In browser DevTools, check Console for hydration/runtime errors and Network for
    failed Server Action POSTs. Do not export cookies/tokens. Check that HTML/RSC
    responses remain private/no-store. Test the form at mobile widths and by keyboard.

## Automated checks

```powershell
npm.cmd run lint
npx.cmd --no-install tsc --noEmit
node --test tests/notes.test.mjs
node --experimental-strip-types --test tests/auth-validation.test.mjs
npm.cmd run build
```

The notes tests run the actual validator/action with mocked framework and database
boundaries. They verify invalid inputs never insert, authentication is rechecked,
only title/body are inserted, success revalidates home, and failures remain generic.
They do not prove remote persistence or RLS enforcement. The existing auth smoke
tests run against a local server with node --test tests/auth-smoke.test.mjs.

References:
- https://nextjs.org/docs/app/getting-started/mutating-data
- https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- https://supabase.com/docs/guides/database/postgres/row-level-security

## Results in this checkout

- Final lint, standalone TypeScript and production build passed.
- Five notes action tests, four auth validation tests and four production HTTP
  smoke tests passed. Initial JSX apostrophe lint warnings were corrected.
- Node printed the existing module-type detection warning for the auth TypeScript
  helper; tests still passed.
- No .env.local or public Supabase configuration in the process was available.
  Live authentication, email delivery, remote table existence, persistence and RLS
  isolation could not be verified. No SQL or remote project changes were made.
- Browser hydration, pending animations, mobile layout and back/forward behaviour
  require the manual checks above; HTTP checks do not execute browser JavaScript.
- The temporary production server was stopped after testing.
