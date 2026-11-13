import type { NoteFormState } from "@/lib/notes-validation";

// Presentational component: usable from server pages or client form components.
export function ActionFeedback({ status, message }: Pick<NoteFormState, "status" | "message">) {
  if (!message) return null;
  const error = status === "error";
  return <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere] ${error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
    {message}
  </p>;
}
