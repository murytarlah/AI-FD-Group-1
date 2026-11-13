"use client";

import { useActionState, useState } from "react";
import { updateNote } from "@/app/actions";
import type { NoteFormState } from "@/lib/notes-validation";
import { ActionFeedback } from "./action-feedback";

export function EditNoteForm({ note }: { note: { id: string; title: string; body: string } }) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [state, action, pending] = useActionState(updateNote, { status: "idle", message: "" } as NoteFormState);
  return <form action={action} aria-busy={pending} className="mt-6 space-y-4">
    <input type="hidden" name="id" value={note.id} />
    <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-70">
      <div>
        <label htmlFor="edit-title" className="text-sm font-semibold text-slate-800">Title (required)</label>
        <input id="edit-title" name="title" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} className="note-field" />
      </div>
      <div>
        <label htmlFor="edit-body" className="text-sm font-semibold text-slate-800">Body (optional)</label>
        <textarea id="edit-body" name="body" rows={8} maxLength={20000} value={body} onChange={event => setBody(event.target.value)} className="note-field resize-y" />
      </div>
      <button className="button-primary w-full sm:w-auto">{pending ? "Saving..." : "Save Changes"}</button>
    </fieldset>
    {!pending && <ActionFeedback status={state.status} message={state.message} />}
  </form>;
}
