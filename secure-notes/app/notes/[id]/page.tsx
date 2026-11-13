import { requireUser } from "@/lib/supabase/auth";
import { PrivateContent } from "@/app/components/private-content";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateNoteId } from "@/lib/notes-validation";
import { EditNoteForm } from "@/app/components/edit-note-form";
import { DeleteNoteButton } from "@/app/components/delete-note-button";
import { DashboardHeader } from "@/app/components/dashboard-header";

export const dynamic = "force-dynamic";

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!validateNoteId(id)) notFound();
  const supabase = await createClient();
  const { data: note, error } = await supabase.from("notes")
    .select("id, title, body").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load note.");
  if (!note) notFound();
  return <PrivateContent userId={user.id}>
    <DashboardHeader email={user.email} />
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/" prefetch={false} className="mb-6 inline-flex min-h-12 items-center rounded-lg text-sm font-semibold text-sage-700 hover:text-sage-800">← Back to My Notes</Link>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Edit Note</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Update your notes, then save your changes.</p>
        <EditNoteForm key={note.id} note={note} />
        <div className="mt-8 border-t border-slate-100 pt-6"><DeleteNoteButton noteId={note.id} title={note.title} /></div>
      </section>
    </main>
  </PrivateContent>;
}
