import Link from "next/link";
import { DeleteNoteButton } from "./delete-note-button";
import { WorkspaceIcon } from "./workspace-icon";

type Note = { id: string; title: string; body: string; created_at: string };

export function NoteCard({ note }: { note: Note }) {
  const characters = Array.from(note.body);
  const preview = characters.length > 280 ? `${characters.slice(0, 280).join("")}…` : note.body;
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(note.created_at));
  return <article aria-labelledby={`note-${note.id}`} className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-sage-200 hover:shadow-md motion-reduce:transition-none sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-xl bg-sage-50 p-2.5 text-sage-700"><WorkspaceIcon name="notebook" /></span>
      <time dateTime={note.created_at} aria-label={`Created ${date}`} className="text-xs font-medium text-slate-500">{date}</time>
    </div>
    <h3 id={`note-${note.id}`} className="mt-4 line-clamp-2 text-lg font-semibold leading-7 tracking-tight text-slate-900 [overflow-wrap:anywhere]">{note.title}</h3>
    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">{preview || "No body text. Add details when you edit this note."}</p>
    <div className="mt-auto pt-6">
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Link href={`/notes/${note.id}`} prefetch={false} aria-label={`Edit note: ${note.title}`} className="button-secondary flex-1"><WorkspaceIcon name="pencil" className="size-4" />Edit</Link>
        <DeleteNoteButton noteId={note.id} title={note.title} />
      </div>
    </div>
  </article>;
}
