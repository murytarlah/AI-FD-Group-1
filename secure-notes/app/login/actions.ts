"use server";

import { revalidatePath } from "next/cache";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { readCredentials, signupMessageCode } from "@/lib/supabase/validation";
import { startIdleSession } from "@/lib/supabase/login-marker";
import { IDLE_SESSION_COOKIE } from "@/lib/idle-session";

export async function logIn(formData: FormData) {
  const credentials = readCredentials(formData, false);
  if (!credentials) redirect("/login?message=invalid-login");
  if (!getSupabaseConfig()) redirect("/login?message=configuration");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) redirect("/login?message=invalid-login");
  await startIdleSession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const credentials = readCredentials(formData, true);
  if (!credentials) redirect("/login?message=invalid-signup");
  if (!getSupabaseConfig()) redirect("/login?message=configuration");
  const supabase = await createClient();
  // Next.js checks Server Action Origin against Host. Supabase also allowlists redirects.
  const origin = (await headers()).get("origin");
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
  });
  if (error) redirect(`/login?message=${signupMessageCode(error.code, error.status)}`);
  revalidatePath("/", "layout");
  if (data.session) { await startIdleSession(); redirect("/"); }
  // Same response whether an address is already registered or newly submitted.
  redirect("/login?message=check-email");
}

async function endSession() {
  if (!getSupabaseConfig()) return false;
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return false;
  (await cookies()).delete(IDLE_SESSION_COOKIE);
  revalidatePath("/", "layout");
  return true;
}

export async function signOut() {
  if (!getSupabaseConfig()) redirect("/login");
  if (!await endSession()) redirect("/?message=logout-failed");
  redirect("/login?message=signed-out");
}

export async function expireIdleSession(expectedMarker: string) {
  if (typeof expectedMarker !== "string" || expectedMarker.length > 100) return { ok: false };
  const current = (await cookies()).get(IDLE_SESSION_COOKIE)?.value;
  // A stale tab must not deliberately sign out a newer login in this browser.
  if (current && current !== expectedMarker) return { ok: false, superseded: true };
  try { return { ok: await endSession() }; }
  catch { return { ok: false }; }
}
