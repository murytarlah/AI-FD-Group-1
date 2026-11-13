"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingLabel = "Please wait…", disabled, ...props }:
  ComponentProps<"button"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button {...props} disabled={disabled || pending} aria-disabled={disabled || pending}>
    {pending ? pendingLabel : children}
  </button>;
}
