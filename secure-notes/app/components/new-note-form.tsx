"use client";

import { useActionState, useState } from "react";
import { createNote } from "@/app/actions";
import type { NoteFormState } from "@/lib/notes-validation";
import { ActionFeedback } from "./action-feedback";
import { WorkspaceIcon } from "./workspace-icon";

const initialState: NoteFormState = { status: "idle", message: "" };

export function NewNoteForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState(async (previous: NoteFormState, form: FormData) => {
    const result = await createNote(previous, form);
    if (result.status === "success") { setTitle(""); setBody(""); }
    return result;
  }, initialState);
  const invalidTitle = state.status === "error" && !title.trim();
  return <form action={action} className="space-y-5" aria-busy={pending}>
    <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-70">
      <legend className="sr-only">Create a new private note</legend>
      <div>
        <label htmlFor="note-title" className="text-sm font-semibold text-slate-800">Title <span className="font-normal text-slate-500">(required)</span></label>
        <input id="note-title" name="title" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Algebra revision - week 3" aria-invalid={invalidTitle || undefined} aria-describedby="note-title-help" className="note-field" />
        <p id="note-title-help" className="mt-2 text-xs leading-5 text-slate-500">A short, descriptive title. Up to 200 characters.</p>
      </div>
      <div>
        <label htmlFor="note-body" className="text-sm font-semibold text-slate-800">Body <span className="font-normal text-slate-500">(optional)</span></label>
        <textarea id="note-body" name="body" rows={7} maxLength={20000} value={body} onChange={event => setBody(event.target.value)} placeholder="Lesson goals, progress, and next steps..." aria-describedby="note-body-help" className="note-field resize-y" />
        <p id="note-body-help" className="mt-2 text-xs leading-5 text-slate-500">Plain text, up to 20,000 characters. Line breaks are preserved.</p>
      </div>
      <button className="button-primary w-full">
        {pending ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" /> : <WorkspaceIcon name="plus" className="size-4" />}
        {pending ? "Saving..." : "Save Note"}
      </button>
    </fieldset>
    {pending ? <p role="status" className="text-sm text-slate-500">Saving your note. Please wait.</p> : <ActionFeedback status={state.status} message={state.message} />}
  </form>;
}
