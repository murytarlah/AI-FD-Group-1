-- Feature 1 only. Review before running manually in Supabase SQL Editor.
-- One-time setup: intentionally fail if public.notes already exists.
BEGIN; -- Apply all statements together; a failure prevents a partial setup.

CREATE TABLE public.notes ( -- public is the schema exposed by the Supabase Data API.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique, non-null note identifier.
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id), -- Existing signed-in owner.
  title text NOT NULL CHECK (title ~ '[^[:space:]]'), -- At least one non-whitespace character.
  body text NOT NULL DEFAULT '', -- Empty text is allowed; NULL is not.
  created_at timestamptz NOT NULL DEFAULT now(), -- Creation instant, with timezone support.
  updated_at timestamptz NOT NULL DEFAULT now() -- Initial value only; no update trigger yet.
);

CREATE INDEX notes_user_id_created_at_idx -- Speeds up an owner's newest-first note list.
  ON public.notes (user_id, created_at DESC);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY; -- Require row policies for normal API roles.

REVOKE ALL ON TABLE public.notes FROM PUBLIC, anon, authenticated; -- Remove inherited/default table grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO authenticated; -- Allow only these operations.

CREATE POLICY notes_select_own ON public.notes -- Reading existing notes.
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()); -- Only the current user's rows are visible.

CREATE POLICY notes_insert_own ON public.notes -- Creating new notes.
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()); -- The proposed row must belong to the current user.

CREATE POLICY notes_update_own ON public.notes -- Editing existing notes.
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) -- The existing row must belong to the current user.
  WITH CHECK (user_id = auth.uid()); -- The resulting row must still belong to that user.

CREATE POLICY notes_delete_own ON public.notes -- Deleting existing notes.
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()); -- Only the current user's rows can be deleted.

COMMIT; -- Save the complete setup together.
