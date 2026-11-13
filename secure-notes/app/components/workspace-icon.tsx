import type { ReactNode } from "react";
type IconName = "notebook" | "logout" | "shield" | "clock" | "plus" | "pencil" | "trash";

// Shared SVGs keep icon weights consistent without an extra dependency.
export function WorkspaceIcon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    notebook: <><rect x="5" y="3" width="15" height="18" rx="3" /><path d="M5 8H3m2 4H3m2 4H3m7-8h6m-6 4h6m-6 4h3" /></>,
    logout: <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m5-12 4 4-4 4m-6-4h10" />,
    shield: <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    pencil: <path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15v5Z" />,
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
