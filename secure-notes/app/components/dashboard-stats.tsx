import { WorkspaceIcon } from "./workspace-icon";

export function DashboardStats({ total, recent }: { total: number | null; recent: number | null }) {
  return <section aria-label="Your note statistics" className="grid w-full min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:w-[29rem] lg:shrink-0">
    {[
      { label: "Total Notes", value: total, hint: "In your private workspace", icon: "notebook" as const },
      { label: "Recently Updated", value: recent, hint: "Within the last 7 days", icon: "clock" as const },
    ].map(stat => <article key={stat.label} className="min-w-0 rounded-2xl border border-sage-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium leading-6 text-slate-600">{stat.label}</h2>
        <span className="rounded-lg bg-sage-50 p-2 text-sage-700"><WorkspaceIcon name={stat.icon} className="size-4" /></span>
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900 [overflow-wrap:anywhere] sm:text-3xl">{stat.value === null ? "—" : stat.value.toLocaleString("en-GB")}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{stat.value === null ? "Temporarily unavailable" : stat.hint}</p>
    </article>)}
  </section>;
}
