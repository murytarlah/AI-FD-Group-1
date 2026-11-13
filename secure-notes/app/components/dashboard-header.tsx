import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { SubmitButton } from "./submit-button";
import { WorkspaceIcon } from "./workspace-icon";

// Server Component: the authenticated page supplies the email; no browser storage.
export function DashboardHeader({ email }: { email?: string }) {
  return <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-[1536px] flex-col gap-5 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <Link href="/" prefetch={false} className="flex w-fit shrink-0 items-center gap-3 rounded-lg" aria-label="Secure Notes home">
        <span className="flex size-11 items-center justify-center rounded-xl bg-sage-600 text-white" aria-hidden="true">
          <WorkspaceIcon name="notebook" className="size-6" />
        </span>
        <span><span className="block text-lg font-bold tracking-tight text-slate-950">Secure Notes</span><span className="block text-xs font-medium text-slate-500">Private Tutor Workspace</span></span>
      </Link>
      <div className="flex min-w-0 items-center justify-between gap-4 sm:justify-end sm:gap-6">
        <div className="min-w-0 sm:text-right">
          <p className="text-xs font-medium text-slate-500">Signed in as</p>
          <p className="mt-1 text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">{email ?? "Tutor account"}</p>
        </div>
        <form action={signOut} data-session-logout className="shrink-0">
          <SubmitButton pendingLabel="Logging out..." className="button-secondary"><WorkspaceIcon name="logout" className="size-4" />Logout</SubmitButton>
        </form>
      </div>
    </div>
  </header>;
}
