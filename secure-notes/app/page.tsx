import { requireUser } from "@/lib/supabase/auth";
import { PrivateContent } from "./components/private-content";
import { NewNoteForm } from "./components/new-note-form";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "./components/dashboard-header";
import { NoteCard } from "./components/note-card";
import { ActionFeedback } from "./components/action-feedback";
import { DashboardStats } from "./components/dashboard-stats";
import { WorkspaceIcon } from "./components/workspace-icon";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ message?: string }>;
}) {
  const user = await requireUser();
  const { message } = await searchParams;
  const supabase = await createClient();
  // RLS scopes every query, including HEAD counts. No browser-supplied owner filter.
  const now = new Date();
  // Rolling 168-hour window, based on updated_at (not created_at or a calendar week).
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [listResult, totalResult, recentResult] = await Promise.allSettled([
    supabase.from("notes").select("id, title, body, created_at").order("created_at", { ascending: false }),
    supabase.from("notes").select("id", { count: "exact", head: true }),
    supabase.from("notes").select("id", { count: "exact", head: true })
      .gte("updated_at", sevenDaysAgo).lte("updated_at", now.toISOString()),
  ]);
  let notes: { id: string; title: string; body: string; created_at: string }[] = [];
  const loadFailed = listResult.status !== "fulfilled" || !!listResult.value.error;
  if (listResult.status === "fulfilled" && !listResult.value.error) notes = listResult.value.data ?? [];
  // A failed count is unavailable, never a misleading hardcoded zero.
  const totalNotes = totalResult.status === "fulfilled" && !totalResult.value.error ? totalResult.value.count : null;
  const recentlyUpdated = recentResult.status === "fulfilled" && !recentResult.value.error ? recentResult.value.count : null;
  return <PrivateContent userId={user.id}>
    <a href="#workspace" className="sr-only z-50 rounded-lg bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to notes workspace</a>
    <DashboardHeader email={user.email} />
    <main id="workspace" className="mx-auto min-h-screen w-full max-w-[1536px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-8 flex min-w-0 flex-col justify-between gap-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-sage-600">YOUR PRIVATE WORKSPACE</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Welcome back!</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">Keep track of student progress with your private notes.</p>
          <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-sage-200 bg-sage-50 px-3 py-2 text-xs font-medium leading-5 text-sage-800"><WorkspaceIcon name="shield" className="size-4" />Your notes are private to your account.</p>
        </div>
        <DashboardStats total={totalNotes} recent={recentlyUpdated} />
      </div>
      <div className="mb-6 space-y-3">
        {message === "note-deleted" && <ActionFeedback status="success" message="Note deleted." />}
        {message === "logout-failed" && <ActionFeedback status="error" message="Unable to sign out. Please try again." />}
        {(totalNotes === null || recentlyUpdated === null) && <ActionFeedback status="error" message="Some note statistics are unavailable. Refresh to try again." />}
      </div>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] xl:gap-8">
        <section aria-labelledby="new-note-heading" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 border-b border-slate-100 pb-5">
            <span className="mb-4 inline-flex rounded-xl bg-sage-50 p-2.5 text-sage-700"><WorkspaceIcon name="plus" /></span>
            <h2 id="new-note-heading" className="text-xl font-semibold tracking-tight text-slate-950">Create a New Note</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Capture something worth remembering.</p>
          </div>
          <NewNoteForm />
        </section>
        <section aria-labelledby="my-notes-heading" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="my-notes-heading" className="text-xl font-semibold tracking-tight text-slate-950">My Notes</h2>
              <p className="mt-1 text-sm text-slate-500">Your latest notes, newest first.</p>
            </div>
            {!loadFailed && <span className="rounded-full border border-sage-200 bg-sage-50 px-3 py-1 text-xs font-medium text-sage-700">Newest first</span>}
          </div>
          {loadFailed ? <ActionFeedback status="error" message="We could not load your notes. Refresh to try again. If this continues, contact the centre administrator." />
            : notes.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center sm:px-10">
              <span aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sage-50 text-sage-600">
                <WorkspaceIcon name="notebook" className="size-7" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">A fresh page for your next lesson</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-slate-500">No notes yet. Capture a lesson plan, a reminder or a next step with your first note.</p>
              <a href="#note-title" className="button-secondary mt-6">Write your first note</a>
            </div>
              : <ul className="grid min-w-0 auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">{notes.map(note => <li key={note.id} className="min-w-0"><NoteCard note={note} /></li>)}</ul>}
          {!loadFailed && totalNotes !== null && totalNotes > notes.length && <p className="mt-4 text-sm text-slate-500">Showing the {notes.length} most recent notes of {totalNotes}.</p>}
        </section>
      </div>
      <p className="mt-10 text-center text-xs leading-6 text-slate-500">Private to your account. You are automatically signed out after 2 minutes of inactivity.</p>
    </main>
  </PrivateContent>;
}
