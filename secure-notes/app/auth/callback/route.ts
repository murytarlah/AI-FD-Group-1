import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { startIdleSession } from "@/lib/supabase/login-marker";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && getSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await startIdleSession();
      return new NextResponse(null, { status: 303, headers: { Location: "/" } });
    }
  }
  // Fixed local destination: never accept an arbitrary redirect URL from input.
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/login?message=confirmation-failed" },
  });
}
