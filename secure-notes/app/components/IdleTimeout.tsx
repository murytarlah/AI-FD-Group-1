"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { expireIdleSession } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";
import { IdleClock, IDLE_SESSION_COOKIE, IDLE_STORAGE_KEY, parseIdleRecord, type IdleStatus, type LogoutReason } from "@/lib/idle-session";

function cookieMarker() {
  return document.cookie.split("; ").find(value => value.startsWith(`${IDLE_SESSION_COOKIE}=`))?.split("=").slice(1).join("=");
}

export function IdleTimeout({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const message = useRef<HTMLParagraphElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const retryLogout = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let loggingOut = false;
    let requestGeneration = 0;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let requestTimer: ReturnType<typeof setTimeout> | undefined;
    let clock: IdleClock;
    let session = cookieMarker();
    let reason: LogoutReason = "inactive";
    let lastInputAt = 0;
    const hide = () => {
      if (content.current) {
        content.current.hidden = true;
        content.current.querySelectorAll("dialog").forEach(dialog => dialog.close());
      }
      if (notice.current) notice.current.hidden = false;
    };
    const showError = () => {
      if (disposed) return;
      hide();
      if (message.current) message.current.textContent = "Your notes are hidden. We could not complete sign out. Check your connection and retry.";
      if (retry.current) retry.current.hidden = false;
    };
    const finishLogout = async (nextReason: LogoutReason) => {
      loggingOut = true;
      reason = nextReason;
      hide();
      clearTimeout(deadlineTimer);
      clearTimeout(flushTimer);
      document.documentElement.dataset.notesLogout = reason;
      if (message.current) message.current.textContent = reason === "inactive" ? "Your session is inactive. Signing out..." : "Signing out...";
      if (retry.current) retry.current.hidden = true;
      const generation = ++requestGeneration;
      clearTimeout(requestTimer);
      requestTimer = setTimeout(showError, 15000);
      try {
        const result = await expireIdleSession(session ?? "");
        if (disposed || generation !== requestGeneration) return;
        clearTimeout(requestTimer);
        if (result.superseded) { window.location.reload(); return; }
        if (!result.ok) { showError(); return; }
        const latest = cookieMarker();
        if (latest && latest !== session) { window.location.reload(); return; }
        window.location.replace(reason === "inactive" ? "/login?reason=inactive" : "/login?message=signed-out");
      } catch {
        if (generation === requestGeneration) { clearTimeout(requestTimer); showError(); }
      }
    };
    const consume = (status: IdleStatus) => {
      if (disposed || loggingOut) return;
      if (status === "changed") {
        loggingOut = true;
        hide();
        clearTimeout(deadlineTimer);
        clearTimeout(flushTimer);
        window.location.reload();
      }
      else if (status !== "active") void finishLogout(status);
      else {
        if (notice.current) notice.current.hidden = true;
        if (content.current) content.current.hidden = false;
        clearTimeout(deadlineTimer);
        deadlineTimer = setTimeout(check, Math.max(0, clock.deadline - Date.now()));
      }
    };
    function check() {
      if (disposed || loggingOut) return;
      try {
        const latest = cookieMarker();
        if (latest && latest !== session) { consume("changed"); return; }
        consume(clock.check());
      } catch { void finishLogout("inactive"); }
    }
    const activity = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== "visible" || disposed || loggingOut) return;
      // Programmatic scroll/restoration can produce trusted scroll events too.
      // Count scrolling only near a real pointer/key/wheel/touch gesture.
      if (event.type === "scroll" && Date.now() - lastInputAt > 1000) return;
      if (event.type !== "scroll") lastInputAt = Date.now();
      try {
        consume(clock.activity());
        if (!loggingOut && !flushTimer) flushTimer = setTimeout(() => {
          flushTimer = undefined;
          try { consume(clock.flush()); } catch { void finishLogout("inactive"); }
        }, 1000);
      } catch { void finishLogout("inactive"); }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === IDLE_STORAGE_KEY || event.key === null) check();
    };
    const onPageHide = () => {
      try { if (!loggingOut) clock.flush(); } catch { /* On return, fail closed. */ }
      hide();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onPageHide();
      check();
    };
    const onSubmit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      check();
      if (loggingOut) { event.preventDefault(); event.stopPropagation(); return; }
      if (!event.target.hasAttribute("data-session-logout")) return;
      event.preventDefault();
      try { if (clock.logout("manual") === "changed") { consume("changed"); return; } }
      catch { /* Still clear the session if storage fails. */ }
      void finishLogout("manual");
    };
    retryLogout.current = () => { if (!disposed) void finishLogout(reason); };
    try {
      // Upgrade an existing login once; later reloads reuse the marker/deadline.
      if (!session) {
        session = parseIdleRecord(localStorage.getItem(IDLE_STORAGE_KEY))?.session ?? `${Date.now()}.${crypto.randomUUID()}`;
        document.cookie = `${IDLE_SESSION_COOKIE}=${session}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        if (cookieMarker() !== session) throw new Error("Cookie storage unavailable");
      }
      delete document.documentElement.dataset.notesLogout;
      clock = new IdleClock(session, () => localStorage.getItem(IDLE_STORAGE_KEY), value => localStorage.setItem(IDLE_STORAGE_KEY, value));
      consume(clock.start());
    } catch { void finishLogout("inactive"); }

    const events = ["keydown", "input", "pointerdown", "pointermove", "click", "wheel", "scroll", "touchstart", "touchmove"];
    events.forEach(name => document.addEventListener(name, activity, { passive: true, capture: true }));
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("pagehide", onPageHide);
    const { data: { subscription } } = createClient().auth.onAuthStateChange(event => {
      if (event !== "SIGNED_OUT" || disposed || loggingOut) return;
      try { clock.logout("manual"); } catch { /* Fail closed even without storage. */ }
      void finishLogout("manual");
    });
    return () => {
      try { if (!loggingOut) clock?.flush(); } catch { /* Never expose content on cleanup. */ }
      disposed = true;
      ++requestGeneration;
      hide();
      clearTimeout(deadlineTimer); clearTimeout(flushTimer); clearTimeout(requestTimer);
      events.forEach(name => document.removeEventListener(name, activity, true));
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("pagehide", onPageHide);
      subscription.unsubscribe();
      retryLogout.current = () => {};
    };
  }, []);

  return <>
    <div ref={notice} role="status" className="p-6">
      <p ref={message}>Checking session inactivity...</p>
      <button ref={retry} type="button" hidden onClick={() => retryLogout.current()} className="mt-4 rounded-lg bg-indigo-700 px-4 py-3 text-white">Retry sign out</button>
    </div>
    <div ref={content} hidden>{children}</div>
  </>;
}
