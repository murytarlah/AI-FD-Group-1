"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { validateNote, validateNoteId, type NoteFormState } from "@/lib/notes-validation";

export async function createNote(_previous: NoteFormState, formData: FormData): Promise<NoteFormState> {
  if (!getSupabaseConfig()) return { status: "error", message: "Supabase is not configured. Please contact the centre administrator." };
  const supabase = await createClient();
  // Server Actions are public endpoints: verify identity independently of Proxy.
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous) redirect("/login");
  const result = validateNote(formData);
  if (!result.values) return { status: "error", message: result.error! };
  try {
    // Never accept a browser-supplied owner. The database default and RLS enforce it.
    const { error } = await supabase.from("notes").insert(result.values);
    if (error) return { status: "error", message: "We couldn't save your note. Please try again. If this continues, ask the administrator to check the notes table and permissions." };
  } catch {
    return { status: "error", message: "We couldn't reach the notes service. Please try again." };
  }
  revalidatePath("/");
  return { status: "success", message: "Note saved." };
}

async function changeNote(operation: "update" | "delete", formData: FormData): Promise<NoteFormState> {
  if (!getSupabaseConfig()) return { status: "error", message: "Supabase is not configured. Please contact the centre administrator." };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous) redirect("/login");

  const noteId = formData.get("id");
  if (!validateNoteId(noteId)) return { status: "error", message: "This note link is invalid." };
  const result = operation === "update" ? validateNote(formData) : null;
  if (result && !result.values) return { status: "error", message: result.error! };
  if (operation === "delete" && formData.get("confirmation") !== "delete") {
    return { status: "error", message: "Please confirm that you want to delete this note." };
  }

  try {
    // The ID targets one row; the user's JWT and RLS decide whether it is accessible.
    // Never accept user_id, created_at, or arbitrary columns from the browser.
    const query = operation === "update"
      ? supabase.from("notes").update({ ...result!.values, updated_at: new Date().toISOString() })
      : supabase.from("notes").delete();
    const { data, error } = await query.eq("id", noteId).select("id").maybeSingle();
    if (error) return { status: "error", message: "We could not change your note. Please try again." };
    // RLS-hidden and nonexistent notes are deliberately indistinguishable.
    if (!data) return { status: "error", message: "Note not found or no longer available." };
  } catch {
    return { status: "error", message: "We could not reach the notes service. Please try again." };
  }

  revalidatePath("/");
  revalidatePath(`/notes/${noteId}`);
  if (operation === "delete") redirect("/?message=note-deleted");
  return { status: "success", message: "Changes saved." };
}

export async function updateNote(_previous: NoteFormState, formData: FormData): Promise<NoteFormState> {
  return changeNote("update", formData);
}

export async function deleteNote(_previous: NoteFormState, formData: FormData): Promise<NoteFormState> {
  return changeNote("delete", formData);
}
