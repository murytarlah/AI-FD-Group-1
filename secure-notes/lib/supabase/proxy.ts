import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  const isProtected = request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/notes/");
  let authenticated = false;

  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          previousCookies.forEach(cookie => response.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });
    // Validate with Auth, not an unverified user object from getSession().
    const { data: { user }, error } = await supabase.auth.getUser();
    authenticated = !error && !!user && !user.is_anonymous;
  }

  if (isProtected && !authenticated) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    const redirected = NextResponse.redirect(destination, 303);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    response.headers.forEach((value, key) => {
      if (["cache-control", "expires", "pragma"].includes(key)) redirected.headers.set(key, value);
    });
    response = redirected;
  }
  // Applies to login/actions/callback as well as protected HTML and RSC responses.
  response.headers.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
