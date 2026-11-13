"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { deleteNote } from "@/app/actions";
import type { NoteFormState } from "@/lib/notes-validation";
import { ActionFeedback } from "./action-feedback";
import { WorkspaceIcon } from "./workspace-icon";

export function DeleteNoteButton({ noteId, title }: { noteId: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  const [state, action, pending] = useActionState(deleteNote, { status: "idle", message: "" } as NoteFormState);
  useEffect(() => {
    const close = () => dialog.current?.close();
    const onVisibility = () => { if (document.visibilityState === "hidden") close(); };
    window.addEventListener("pagehide", close);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", close);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return <>
    <button type="button" aria-label={`Delete note: ${title}`} className="button-danger"
      onClick={() => { dialog.current?.showModal(); cancel.current?.focus(); }}><WorkspaceIcon name="trash" className="size-4" />Delete</button>
    <dialog ref={dialog} aria-labelledby={headingId} aria-describedby={descriptionId}
      onCancel={event => { if (pending) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl backdrop:bg-slate-950/40 sm:p-8">
      <h2 id={headingId} className="text-xl font-bold">Delete this note?</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">Permanently delete &quot;{title}&quot;? This cannot be undone.</p>
      <form action={action} aria-busy={pending} className="mt-5">
        <input type="hidden" name="id" value={noteId} />
        <input type="hidden" name="confirmation" value="delete" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button ref={cancel} type="button" disabled={pending} onClick={() => dialog.current?.close()} className="button-secondary">Cancel</button>
          <button disabled={pending} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{pending ? "Deleting..." : "Delete permanently"}</button>
        </div>
        {state.message && <div className="mt-4"><ActionFeedback status="error" message={state.message} /></div>}
      </form>
    </dialog>
  </>;
}
