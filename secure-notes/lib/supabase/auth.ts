import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./server";
import { getSupabaseConfig } from "./config";

export async function requireUser() {
  if (!getSupabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) redirect("/login");
  return user;
}
