
"use client";

import { useState, type FormEvent } from "react";
import { checkNote } from "./actions";

type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
};

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const result = await checkNote(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const note: Note = {
        ...result.note,
        id: crypto.randomUUID(),
      };

      setNotes((currentNotes) => [note, ...currentNotes]);
      setSuccess(`"${note.title}" was added to your notes.`);
      form.reset();
    } catch (error) {
      console.error("Could not create note:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-stone-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-lg font-bold text-white">
                N.
              </div>
              <span className="text-sm font-semibold tracking-wide">
                little notes
              </span>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
              Your personal space
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Notes, made simple.
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600 sm:text-base">
              Gather your thoughts, organise your ideas and make space
              for what matters.
            </p>
          </div>

          <div className="w-fit rounded-2xl border border-stone-200 bg-white px-5 py-3">
            <p className="text-xs text-stone-500">Notes in this session</p>
            <p className="mt-1 text-2xl font-bold">{notes.length}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Create a note
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                What&apos;s on your mind?
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Write it down now. You can organise it with tags.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-semibold"
                >
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="e.g. Ideas for this week"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="body"
                  className="mb-2 block text-sm font-semibold"
                >
                  Your note
                </label>
                <textarea
                  id="body"
                  name="body"
                  rows={8}
                  placeholder={"# Today's priorities\n\nWrite your thoughts here...\n\n- First task\n- Second task"}
                  className="w-full resize-y rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-2 text-xs text-stone-500">
                  Markdown supported. Preview formatting will be added next.
                </p>
              </div>

              <div>
                <label
                  htmlFor="tags"
                  className="mb-2 block text-sm font-semibold"
                >
                  Tags <span className="font-normal text-stone-400">(optional)</span>
                </label>
                <input
                  id="tags"
                  name="tags"
                  type="text"
                  placeholder="work, church, ideas"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-2 text-xs text-stone-500">
                  Separate tags with commas. We&apos;ll tidy them up for you.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-stone-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Checking note..." : "Save note →"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-stone-400">
              Notes are held in memory for now. Refresh-safe saving comes next.
            </p>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-7 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Your collection
                </p>
                <h2 className="mt-2 text-2xl font-bold">Recent thoughts</h2>
              </div>

              <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
                {notes.length} {notes.length === 1 ? "note" : "notes"}
              </span>
            </div>

            {notes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                  ✎
                </div>
                <h3 className="mt-4 font-semibold">A little space for your thoughts</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-stone-500">
                  Your notes will appear here after you save your first one.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-2xl border border-stone-200 p-5 transition hover:border-emerald-300 hover:shadow-sm"
                  >
                    <h3 className="break-words text-lg font-bold">
                      {note.title}
                    </h3>

                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">
                      {note.body}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {note.tags.length > 0 ? (
                        note.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                          >
                            #{tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-stone-400">No tags</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-stone-400">
          One thought at a time.
        </footer>
      </div>
    </main>
  );
}
