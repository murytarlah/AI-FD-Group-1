"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { IdleTimeout } from "./IdleTimeout";

// Defence against stale browser/router snapshots. Server checks remain mandatory.
export function PrivateContent({ userId, children }: { userId: string; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let generation = 0;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
      if (content.current) content.current.hidden = true;
      if (status.current) status.current.hidden = false;
    };
    const verify = async () => {
      const check = ++generation;
      hide();
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active || check !== generation) return;
        if (document.documentElement.dataset.notesLogout) { hide(); return; }
        if (error || !user || user.is_anonymous || user.id !== userId) {
          window.location.replace("/login");
          return;
        }
        if (content.current) content.current.hidden = false;
        if (status.current) status.current.hidden = true;
      } catch {
        if (active && check === generation) window.location.replace("/login");
      }
    };
    const onPageHide = () => { ++generation; hide(); };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) { hide(); window.location.reload(); }
      else void verify();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onPageHide();
      else void verify();
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") {
        onPageHide();
        if (!document.documentElement.dataset.notesLogout) window.location.replace("/login");
      }
      // Avoid calling another Auth method while its event callback holds a lock.
      else {
        clearTimeout(authTimer);
        authTimer = setTimeout(() => { if (active) void verify(); }, 0);
      }
    });
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    void verify();
    return () => {
      active = false;
      ++generation;
      hide();
      clearTimeout(authTimer);
      subscription.unsubscribe();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId]);

  return <IdleTimeout key={userId}>
    <p ref={status} role="status" className="p-6">Checking your session… If this takes too long, <a href="/login" className="underline">return to login</a>.</p>
    <noscript><p>JavaScript is required to display private pages safely. You can still <a href="/login">return to login</a>.</p></noscript>
    <div ref={content} hidden>{children}</div>
  </IdleTimeout>;
}
