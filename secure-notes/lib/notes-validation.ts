export type NoteFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

export function validateNoteId(value: unknown): value is string {
  // notes.id is a PostgreSQL UUID, not a number or an arbitrary URL fragment.
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validateNote(formData: FormData) {
  const title = formData.get("title");
  const body = formData.get("body");
  if (typeof title !== "string" || !title.trim()) {
    return { error: "Enter a title containing at least one non-whitespace character." };
  }
  if (body !== null && typeof body !== "string") {
    return { error: "The note body must be plain text." };
  }
  if (title.length > 200 || (body?.length ?? 0) > 20000) {
    return { error: "Use at most 200 characters for the title and 20,000 for the body." };
  }
  return { values: { title: title.trim(), body: body ?? "" } };
}
