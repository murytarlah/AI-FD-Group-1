# Feature 1: notes table and ownership security

Status: prepared for review, not executed. SPEC-secure-notes.md was not found in
the repository; this feature follows the requested numbered requirements.
No app code, login pages, CRUD pages, Supabase settings, or secrets were changed.

## Read schema.sql line by line

The comments beside each SQL line explain its immediate purpose. The concepts are:

1. `BEGIN` starts a transaction. `COMMIT` saves it. If a statement fails, the
   transaction cannot commit a partial setup. Run `ROLLBACK;` to clear an aborted
   transaction before investigating. Do not remove an existing table to fix an error.
2. `CREATE TABLE public.notes (` creates a table named notes inside the public
   schema (a database namespace). No `IF NOT EXISTS` is used: an existing table
   must be inspected, rather than silently accepting an unknown schema or policies.
3. `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` gives each note a generated
   UUID identifier. A primary key is unique and cannot be NULL. It identifies the
   row; knowing or guessing an ID does not grant access to it.
4. `user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id)` records
   ownership. The foreign key requires an existing Supabase Auth user. `NOT NULL`
   requires an owner. `auth.uid()` reads the current user's ID from the request's
   authentication context. A default fills an omitted value; it does not prevent
   an attacker submitting a different value. The INSERT policy handles that.
   No cascading delete is specified: deleting a referenced Auth user is blocked
   while their notes exist. Account deletion behaviour needs a later decision.
5. `title text NOT NULL CHECK (title ~ '[^[:space:]]')` requires text with at least
   one non-whitespace character. `~` means regular-expression matching. The check
   rejects empty titles and titles made only of spaces, tabs or newlines. It does
   not trim the stored title. `NOT NULL` separately rejects missing/NULL titles.
6. `body text NOT NULL DEFAULT ''` allows an empty note body. Empty text and NULL
   are different: this column always holds text, even when it has zero characters.
7. `created_at timestamptz NOT NULL DEFAULT now()` records the transaction's
   current instant. PostgreSQL stores an instant; display uses the session timezone.
8. `updated_at timestamptz NOT NULL DEFAULT now()` starts at the same instant.
   A DEFAULT is applied on insertion, not on each update. No timestamp trigger
   is included. These timestamps are not tamper-proof audit fields: an owner with
   UPDATE permission can change them. Automatic maintenance can be added later.
9. `);` closes the column list and ends the CREATE TABLE statement.
10. `CREATE INDEX ... ON public.notes (user_id, created_at DESC)` creates a
    lookup structure for finding one user's notes, newest first. It takes storage
    and adds some write overhead. An index improves speed, not permission checks.
11. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` activates per-row checks. Without
    applicable policies, normal roles cannot access rows. Privileged administrators,
    table owners and roles with BYPASSRLS can bypass RLS; this script does not try
    to restrict the project's administrator.
12. `REVOKE ALL ... FROM PUBLIC, anon, authenticated` removes existing table-level
    grants for these roles. PUBLIC means all database roles; it is different from
    the lowercase public schema. `anon` is the signed-out API role. Revoking from
    authenticated first avoids relying on default privileges, including TRUNCATE.
13. `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` opens the table-level
    gate for signed-in requests. RLS is the second gate, deciding which rows each
    request can read or change. No TRUNCATE permission is granted because row
    policies do not protect TRUNCATE. Existing Supabase schema access is assumed.
14. Each `CREATE POLICY name ON public.notes` names one rule for this table.
    `FOR ...` chooses the operation and `TO authenticated` limits the rule to
    the signed-in API role. There are exactly four policies.
15. SELECT's `USING (user_id = auth.uid())` hides other users' notes. Without this
    rule, owners would also be unable to read their own notes. SELECT visibility
    is also needed for normal updates and queries returning affected rows.
16. INSERT's `WITH CHECK (user_id = auth.uid())` checks the new row and rejects
    attempts to create notes under another person's ID, even if user_id is supplied
    manually. It also rejects an unauthenticated/null identity.
17. UPDATE's `USING` checks the old row, preventing edits to another owner's note.
    Its `WITH CHECK` checks the resulting row, preventing an owner transferring
    their note to someone else by changing user_id. Both checks are necessary.
18. DELETE's `USING` prevents deleting another user's notes. Hidden rows normally
    produce zero affected rows rather than an authorisation error.
19. Every ownership condition is exactly `user_id = auth.uid()`. An authenticated
    role alone is not enough: many different users share that database role.
20. `COMMIT` ends the transaction and saves the table, index, grants and policies.

Authentication answers "Who are you?" Supabase Auth verifies a session and supplies
the user's identity. Authorisation answers "What may you do?" PostgreSQL grants
and RLS enforce that decision. A publishable key identifies the project; it is
not a signed-in user's identity. No database password, secret key or service-role
key is needed in application code. Browser-side filters can be bypassed, so they
cannot replace these database rules.

## Review and run manually, when ready

1. Open db/schema.sql locally and read it alongside this guide. It creates a new
   public.notes table; it does not migrate an existing one. Confirm that the target
   project has no existing notes table. If it does, stop and review its structure
   and policies before preparing a migration.
2. Sign in to the Supabase Dashboard and select the intended development project.
   Check the project name and project reference; avoid a production/student-data
   project for your first test.
3. Open **SQL Editor**, create a **New query**, and name it "Feature 1 notes schema".
4. Paste the complete contents of schema.sql, including BEGIN and COMMIT. Check
   that the editor contains only this script. At this point nothing has executed.
5. When you have finished your review and choose to apply it, click **Run**.
   Expect successful completion. If an error occurs, record it, run `ROLLBACK;`
   if needed, and investigate. Do not repeatedly rerun or drop existing objects.
6. Inspect public.notes in Table Editor, and its policies in the table's RLS
   settings. In a separate SQL Editor query, run these read-only inspections:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notes'
ORDER BY ordinal_position;

SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notes'::regclass;

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notes';

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'notes';
```

Expect RLS true, exactly four authenticated policies, the ownership expressions
described above, and both the primary-key index and the composite notes index.
The SQL Editor normally uses a privileged role: seeing every row there does not
prove that RLS is broken or working.

## Safe policy tests after applying the schema

Use a development project, synthetic notes, and two disposable Auth users A and B.
Create or select those users manually in Authentication > Users; copy their UUIDs.
Do not create fake auth.users rows or use real tutoring records. Auth-user creation
is outside a database test transaction and must be cleaned up separately.

To test without login pages, a project administrator can simulate authenticated
requests in SQL Editor using transaction-local role and claims. This simulation
tests database rules, not login, JWT verification or an end-to-end API session.
The UUIDs below must be replaced with the real disposable users' UUIDs. Run each
test as a complete transaction, never just a selected line:

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"USER_A_UUID","role":"authenticated"}', true);
SELECT current_user, auth.uid(); -- Must be authenticated and A's UUID.
INSERT INTO public.notes (title) VALUES ('Disposable A note');
SELECT * FROM public.notes; -- A's notes only, even without an ownership filter.
UPDATE public.notes SET body = 'Changed' WHERE title = 'Disposable A note';
DELETE FROM public.notes WHERE title = 'Disposable A note';
ROLLBACK; -- Undo every data change and reset the temporary role/claims.
```

For a two-user isolation test, in another complete transaction create one synthetic
note as A with the setup above; switch the local claims to B with the same
set_config call and B's UUID, then insert B's note. Switch back to A and test
reading, updating and deleting B's note by its known ID. Expect no visible B rows
and zero affected B rows. Repeat with the users reversed. End with ROLLBACK.
Using an ID in a test targets a particular row; it is not an application ownership
filter. Do not add `user_id = ...` to these SELECT tests: that could hide an RLS bug.

Run each expected-error test in its own BEGIN/role/claims transaction. After an
error PostgreSQL aborts the transaction: run ROLLBACK before the next test.

| Test | Expected result |
| --- | --- |
| A inserts with user_id omitted | Owner defaults to A; insert succeeds |
| A inserts a row explicitly owned by B | INSERT RLS rejection |
| A changes their own note's user_id to B | UPDATE WITH CHECK rejection |
| A targets B's note for UPDATE or DELETE | Zero rows affected |
| B targets A's note | Same isolation in the opposite direction |
| Title is '', spaces, a tab, or a newline | CHECK constraint rejection |
| Title is NULL | NOT NULL rejection |
| Body omitted or '' | Accepted as empty text |
| Body is NULL | NOT NULL rejection |
| Owner references a nonexistent user | Foreign-key rejection when tested as administrator; authenticated requests can fail RLS first |
| SET LOCAL ROLE anon, then SELECT/INSERT/UPDATE/DELETE | Permission denied; no data access |
| authenticated role with empty JWT claims | auth.uid() is NULL; no visible rows; insert rejected |

For the last test explicitly set request.jwt.claims to '{}' within its transaction.
For every test ensure ROLLBACK is sent, including after an expected error. Do not
use COMMIT in these tests. If disposable Auth users were created, remove them
after rolling back all test notes. Later, repeat the isolation tests through real
signed-in browser sessions to verify the API/authentication integration as well.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Supabase database and SQL Editor](https://supabase.com/docs/guides/database/overview),
[PostgreSQL CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html).
