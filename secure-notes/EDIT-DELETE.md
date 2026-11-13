# Feature 4: Edit and Delete Notes

SPEC-secure-notes.md was not found. This feature follows the requested requirements
and builds on your confirmed two-account creation/listing tests. No SQL, policies,
credentials, dependencies, library files or remote data were changed by this work.

## Important code

- Each dashboard card links to /notes/[id] with prefetch disabled. That dynamic page
  calls requireUser(), validates the UUID, then uses the existing per-request server
  client to SELECT only id, title and body for that ID. An RLS-hidden note and a
  nonexistent note both return no row, so both call notFound(). No content is sent
  to the form in that case. Database errors use the existing safe retry screen.
- EditNoteForm starts with the selected title/body. Controlled fields retain drafts
  on errors. useActionState connects Save Changes to the updateNote Server Action;
  saving disables fields and shows a pending label, then a success/error message.
- updateNote and deleteNote share a private helper in app/actions.ts. Every call
  creates a user-scoped client and independently verifies getUser(). Anonymous or
  unauthenticated users redirect to login. Neither Proxy nor visible buttons are
  accepted as proof of permission: an attacker can send a direct POST instead.
- validateNoteId checks UUID shape before any mutation query. UPDATE also reuses
  the title/body validator: no whitespace-only title, no uploaded files as text,
  title limit 200 characters, body limit 20,000. An omitted body becomes empty text.
  Hidden IDs are untrusted inputs and receive exactly the same checks.
- UPDATE modifies an existing record; DELETE permanently removes one. Each query
  chains .eq('id', noteId), meaning SQL WHERE id = the supplied validated UUID.
  This targets the record but does not establish ownership. Supabase carries the
  user's session JWT and PostgreSQL evaluates the existing RLS policies.
- UPDATE's USING checks ownership of the old row; WITH CHECK checks the resulting
  row. DELETE's USING checks which existing rows can be removed. SELECT visibility
  is also required for returning affected IDs. The actions never accept user_id or
  created_at. UPDATE sends only validated title/body plus a server-generated
  updated_at timestamp, because the current schema has no automatic update trigger.
- Both mutations chain .select('id').maybeSingle(). A valid UUID may still match
  zero rows due to RLS or a prior deletion. A zero-row result is not success and
  gets the same unavailable message, without disclosing which reason applies.
  Database/network errors are generic, with no raw SQL, credentials or note content.
- Successful changes revalidate both / and the individual editing URL. Edits keep
  the user on the form with Changes saved. Deletion redirects to / with Note deleted.
  Redirects are outside the database try/catch because Next.js implements redirects
  by throwing a special signal that should not be mistaken for a database error.
- DeleteNoteButton uses native dialog: labelled heading and description, modal
  focus containment, initial focus on Cancel, Escape cancellation while idle, and
  explicit Delete permanently submission. Native dialog restores focus to the
  opener when closed. Pending deletion disables repeat submissions. The dialog
  closes when the page is hidden/left to avoid leaving private content in a browser
  history snapshot. The confirmation marker is checked server-side; it prevents
  accidental form submissions, but is not an authorisation mechanism.
- Existing dynamic rendering, no-store fetches/headers and PrivateContent guards
  remain. Never wrap private note reads in a shared cache or replace RLS with a
  browser-supplied owner ID. No service-role key is involved.

The page is an editor, not a version-control system: concurrent edits use the last
successful write. A network failure after the server committed can leave an
uncertain outcome; check the dashboard before retrying a destructive operation.

## Manual browser checklist (not executed by the assistant)

1. Run npm.cmd run dev inside secure-notes and log in as account A. Create two
   disposable notes. Confirm existing creation, listing and logout still work.
2. Choose Edit on the first card. Title and multiline body must be prefilled.
   Change both, save, and check the pending label and Changes saved message.
   Return to My Notes and refresh: the changed text must persist. The second note
   must be unchanged. Editing does not change created_at or reorder creation time.
3. Save a whitespace-only title: expect validation and no saved change. Test with
   browser validation disabled too. Empty body is allowed; HTML/script markup must
   remain plain text. Failed validation must retain the draft.
4. Open Delete from a dashboard card or editor. Use Tab/Shift+Tab: focus must stay
   in the dialog. Cancel is focused initially. Test Cancel and Escape: the note must
   remain. With keyboard only, choose Delete permanently; expect Deleting, then
   the dashboard with Note deleted. Refresh: the deleted note must remain absent.
5. While logged in as A, copy A's editing URL. In account B's browser, paste that
   URL. Expect Not Found and no A title/body. A random valid UUID and an invalid UUID
   must also reveal no content. While signed out, the URL must redirect to login.
6. In development, tamper with an update/delete form's ID to use A's UUID while
   signed in as B. Expect unavailable/error feedback, no success, and A's data must
   remain unchanged. Adding user_id to a form must never change ownership. Repeat
   with the accounts reversed. UI button visibility alone cannot test this boundary.
7. Open one note in two tabs. Delete it in one, then save/delete from the stale tab:
   expect unavailable feedback, not success. Reloading its URL should show Not Found.
8. Simulate a failed request using browser network tools. Expect safe error/retry
   feedback, with no raw SQL or credentials. Restore the network and verify the
   actual saved state before retrying. Never export cookies/session tokens.
9. Test mobile widths, long titles, keyboard focus, pending buttons and screen-reader
   dialog/status announcements. Sign out, then use refresh/Back/Forward and a second
   account: private note content must not return under the wrong session.

## Automated verification

Run lint, TypeScript, build and node --test tests/notes.test.mjs. The latter runs real
action/page source with mocked framework/database boundaries. It tests ID and field
validation, authentication, targeted mutations, no owner-field updates, zero-row
handling, safe errors, revalidation, and the page's Not Found/prefill behaviour.
These are not browser or live RLS tests. No real notes were edited/deleted by tests.

Verification results: lint, standalone TypeScript and production build passed with
no failures. All 14 note/action/page tests, 5 auth-validation tests and 4 production
HTTP smoke tests passed. Node emitted the existing harmless module-type detection
warning for direct auth-validator imports. The temporary production server was
stopped. No browser interaction, screen-reader or live UPDATE/DELETE tests were run.

Official references:
- https://supabase.com/docs/reference/javascript/update
- https://supabase.com/docs/reference/javascript/using-modifiers-select
- https://nextjs.org/docs/app/api-reference/functions/notFound
- https://nextjs.org/docs/app/api-reference/functions/revalidatePath
