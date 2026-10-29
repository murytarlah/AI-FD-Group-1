
"use client";

import { useEffect, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  NotebookPen,
  Plus,
  Search,
  Tag,
  Trash2,
  Eye,
  Pencil,
  FileText,
  X,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { checkNote } from "./actions";

type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
};

const STORAGE_KEY = "little-notes-v1";

function MarkdownBody({ body }: { body: string }) {
  return (
    <div className="break-words text-sm leading-7 text-gray-700">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-2xl font-bold text-gray-900">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-xl font-bold text-gray-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 text-lg font-semibold text-gray-900">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-3">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-bold text-gray-950">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-5 list-decimal space-y-1">
              {children}
            </ol>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-gray-900 underline underline-offset-4 hover:text-gray-500"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-gray-300 pl-4 italic text-gray-600">
              {children}
            </blockquote>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Load saved notes in the browser after the first render.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (
          Array.isArray(parsed) &&
          parsed.every(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.title === "string" &&
              typeof item.body === "string" &&
              Array.isArray(item.tags) &&
              item.tags.every((tag: unknown) => typeof tag === "string")
          )
        ) {
          // Hydration needs the browser-only storage read after the first render.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setNotes(parsed as Note[]);
        }
      }
    } catch {
      setStorageWarning(
        "Saved notes could not be read from this browser."
      );
    } finally {
      setHasLoaded(true);
    }
  }, []);

  // Only save after the initial loading has finished.
  useEffect(() => {
    if (!hasLoaded) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(notes)
      );
    } catch {
      // Report storage failure from the persistence effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageWarning(
        "Your browser could not save changes. Check its storage settings."
      );
    }
  }, [notes, hasLoaded]);

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

      setNotes((current) => [note, ...current]);
      setSuccess(`"${note.title}" was saved successfully.`);
      form.reset();
      setBody("");
      setShowPreview(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function deleteNote(note: Note) {
    const confirmed = window.confirm(
      `Delete "${note.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setNotes((current) =>
      current.filter((item) => item.id !== note.id)
    );
    setSuccess(`"${note.title}" was deleted.`);
    setError("");
  }

  const allTags = Array.from(
    new Set(notes.flatMap((note) => note.tags))
  ).sort();

  const filteredNotes = notes.filter((note) => {
    const term = search.trim().toLowerCase();

    const matchesSearch =
      !term ||
      note.title.toLowerCase().includes(term) ||
      note.body.toLowerCase().includes(term);

    const matchesTag =
      !activeTag || note.tags.includes(activeTag);

    return matchesSearch && matchesTag;
  });

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-sm">
              <NotebookPen size={24} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Grey Notes
              </h1>
              <p className="text-sm text-gray-500">
                A little space for every thought.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <FileText size={18} className="text-gray-500" />
            <span className="text-sm font-medium">
              {hasLoaded ? notes.length : "..."}{" "}
              {notes.length === 1 ? "note" : "notes"}
            </span>
          </div>
        </header>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <Sparkles
            size={20}
            className="mt-0.5 shrink-0 text-gray-500"
          />
          <div>
            <p className="font-semibold">Your thoughts, organised.</p>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Write in Markdown, organise with tags and find your notes
              whenever you return to this browser.
            </p>
          </div>
        </div>

        {storageWarning && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {storageWarning}
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* NOTE EDITOR */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-gray-100 p-2.5">
                <Plus size={21} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Create a note</h2>
                <p className="text-sm text-gray-500">
                  Capture something worth remembering.
                </p>
              </div>
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
                  placeholder="Give your note a name"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-gray-500 focus:bg-white focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label htmlFor="body" className="text-sm font-semibold">
                    Note body
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowPreview((value) => !value)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-950"
                  >
                    {showPreview ? (
                      <Pencil size={14} />
                    ) : (
                      <Eye size={14} />
                    )}
                    {showPreview ? "Write" : "Preview"}
                  </button>
                </div>

                {showPreview ? (
                  <>
                    <input
                      type="hidden"
                      name="body"
                      value={body}
                    />
                    <div className="min-h-48 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      {body.trim() ? (
                        <MarkdownBody body={body} />
                      ) : (
                        <p className="text-sm text-gray-400">
                          Your Markdown preview will appear here.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <textarea
                    id="body"
                    name="body"
                    rows={8}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={
                      "# This week\n\n- **First task**\n- Second task\n\nAdd a [link](https://example.com)"
                    }
                    className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-gray-500 focus:bg-white focus:ring-2 focus:ring-gray-200"
                  />
                )}

                <p className="mt-2 text-right text-xs text-gray-400">
                  {body.length} characters · Markdown supported
                </p>
              </div>

              <div>
                <label
                  htmlFor="tags"
                  className="mb-2 block text-sm font-semibold"
                >
                  Tags{" "}
                  <span className="font-normal text-gray-400">
                    · optional
                  </span>
                </label>

                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-gray-200">
                  <Tag size={17} className="shrink-0 text-gray-400" />
                  <input
                    id="tags"
                    name="tags"
                    placeholder="work, church, ideas"
                    className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                  />
                </div>

                <p className="mt-2 text-xs text-gray-400">
                  Use commas between tags. Duplicates are removed automatically.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  <X size={18} className="shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-100 p-3 text-sm text-gray-700"
                >
                  <CheckCircle2 size={18} className="shrink-0" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !hasLoaded}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} />
                {isSubmitting ? "Saving note..." : "Save note"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs leading-5 text-gray-400">
              Notes are saved in this browser. They do not yet sync between devices.
            </p>
          </section>

          {/* NOTES COLLECTION */}
          <section className="min-w-0 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5">
              <h2 className="text-xl font-bold">Your collection</h2>
              <p className="mt-1 text-sm text-gray-500">
                Search, filter and revisit your thoughts.
              </p>
            </div>

            <div className="mb-5 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-gray-200">
              <Search size={18} className="shrink-0 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles and note contents..."
                aria-label="Search notes by title or body"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Filter by tag
                </p>

                {activeTag && (
                  <button
                    type="button"
                    onClick={() => setActiveTag("")}
                    className="text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-950"
                  >
                    Clear filter
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTag("")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeTag === ""
                      ? "bg-gray-900 text-white"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  All ({notes.length})
                </button>

                {allTags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() =>
                      setActiveTag((current) =>
                        current === tag ? "" : tag
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeTag === tag
                        ? "bg-gray-700 text-white"
                        : "border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <p className="text-sm font-medium text-gray-600">
                {search || activeTag
                  ? `${filteredNotes.length} matching ${
                      filteredNotes.length === 1 ? "note" : "notes"
                    }`
                  : "Recent notes"}
              </p>

              {!hasLoaded && (
                <span className="text-xs text-gray-400">Loading...</span>
              )}
            </div>

            {!hasLoaded ? (
              <div className="py-12 text-center text-sm text-gray-500">
                Loading your saved notes...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-12 text-center">
                {notes.length === 0 ? (
                  <>
                    <NotebookPen
                      size={30}
                      className="mx-auto text-gray-400"
                    />
                    <h3 className="mt-3 font-semibold">
                      Your space is ready
                    </h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Save your first note using the form.
                    </p>
                  </>
                ) : (
                  <>
                    <Search
                      size={30}
                      className="mx-auto text-gray-400"
                    />
                    <h3 className="mt-3 font-semibold">
                      No notes match
                    </h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Try another word or clear your tag filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setActiveTag("");
                      }}
                      className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNotes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-400 hover:shadow-sm sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 break-words text-lg font-bold">
                        {note.title}
                      </h3>

                      <button
                        type="button"
                        onClick={() => deleteNote(note)}
                        aria-label={`Delete ${note.title}`}
                        title="Delete note"
                        className="shrink-0 rounded-xl border border-gray-200 p-2.5 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="mt-3">
                      <MarkdownBody body={note.body} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                      {note.tags.length > 0 ? (
                        note.tags.map((tag) => (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => setActiveTag(tag)}
                            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-200"
                          >
                            #{tag}
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">
                          No tags
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-gray-400">
          Made for your thoughts, one note at a time.
        </footer>
      </div>
    </main>
  );
}
