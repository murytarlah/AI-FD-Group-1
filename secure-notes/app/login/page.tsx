import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { logIn, signUp } from "./actions";
import { SubmitButton } from "@/app/components/submit-button";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  "invalid-login": "Wrong email or password",
  "invalid-signup": "Enter a valid email and a password of at least 8 characters.",
  "signup-failed": "Unable to sign up. Please try again later or log in.",
  "signup-rate-limit": "Too many signup or confirmation email requests. Please wait before trying again, and check your inbox and spam folder for an earlier email.",
  "signup-password-policy": "Your password does not meet this project's password policy. Try a longer, unique password with mixed character types.",
  "signup-email-invalid": "This email address is not accepted by the authentication service. Use a valid email address that you can access.",
  "signup-email-delivery": "The project's email service cannot deliver confirmation to this address. Ask the centre administrator to check the Supabase email/SMTP setup.",
  "signup-unavailable": "Email signup is disabled for this project. Please contact the centre administrator.",
  "signup-captcha": "The service requires a valid CAPTCHA check. Please contact the centre administrator to check CAPTCHA integration.",
  "signup-connection": "The authentication service could not be reached. Check your connection and try again.",
  "signup-configuration": "The authentication service rejected this request. Ask the centre administrator to check the project URL, publishable key and Auth configuration.",
  "check-email": "If signup is available for this address, check your email to confirm it, then log in.",
  "signed-out": "You have signed out.",
  "confirmation-failed": "Unable to confirm this link. Try logging in or request a new signup email.",
  configuration: "Authentication is not configured yet.",
};

export default async function Login({ searchParams }: {
  searchParams: Promise<{ message?: string; reason?: string }>;
}) {
  const configured = !!getSupabaseConfig();
  if (configured) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user && !user.is_anonymous) redirect("/");
  }
  const { message, reason } = await searchParams;
  const notice = reason === "inactive" ? "Your session expired due to inactivity. Please log in again." : message ? messages[message] : undefined;
  const fieldClass = "mt-2 w-full rounded-lg border border-slate-400 bg-white p-3 text-slate-950 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-700";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-950">
      <section aria-labelledby="login-heading" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-700">Tutoring centre</p>
        <h1 id="login-heading" className="mt-2 text-3xl font-bold">Secure Notes</h1>
        <p className="mt-3 text-slate-600">Log in or create an account with your email and password.</p>
        {!configured && <p role="status" className="mt-5 rounded-lg bg-amber-50 p-3 text-amber-950">Authentication is not configured yet. Add the public Supabase settings to .env.local and restart the server.</p>}
        {notice && <p role="status" aria-live="polite" className="mt-5 rounded-lg bg-slate-100 p-3">{notice}</p>}
        <form action={logIn} className="mt-6 space-y-5">
          <div>
            <label htmlFor="email" className="font-medium">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="password" className="font-medium">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} aria-describedby="password-help" className={fieldClass} />
            <p id="password-help" className="mt-2 text-sm text-slate-600">Use at least 8 characters when signing up.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SubmitButton disabled={!configured} className="min-h-12 flex-1 rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">Log In</SubmitButton>
            <SubmitButton formAction={signUp} disabled={!configured} className="min-h-12 flex-1 rounded-lg border border-indigo-700 px-4 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">Sign Up</SubmitButton>
          </div>
        </form>
      </section>
    </main>
  );
}
