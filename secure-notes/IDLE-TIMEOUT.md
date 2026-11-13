# Two-minute inactivity logout

This feature changes session handling only. Notes CRUD, server authentication and
RLS are unchanged. The idle limit is exactly 120000 milliseconds.

## How it works

- app/components/IdleTimeout.tsx is a reusable client wrapper mounted inside
  PrivateContent, so the dashboard and note editor use it but /login does not.
  Protected content starts hidden until both idle and existing user checks pass.
- useEffect installs browser listeners after mounting. Its cleanup removes every
  listener, unsubscribes Auth events, clears timers, flushes pending activity and
  prevents an old async result from updating an unmounted page. React development
  Strict Mode may mount effects twice; persisted metadata prevents that restarting
  the deadline or leaving duplicate listeners behind.
- Real key, click, pointer, wheel and touch input renews the deadline. Untrusted
  script-dispatched events are ignored. Scroll events are counted only near real
  input because automatic scroll restoration can also produce trusted scroll
  events. Background fetches and Auth refresh events never count as user activity.
- Date.now() gives wall-clock milliseconds. Each deadline is last activity plus
  120000. setTimeout schedules the next check, but focus, pageshow and visibility
  events compare actual time again. A suspended browser may delay JavaScript; it
  must lock on resuming instead of assuming a delayed timer means time stood still.
  Changing the device clock or editing storage can influence a client-only timer.
- localStorage persists one small record across refreshes and same-origin tabs:
  an opaque non-secret login marker, deadline, logged-out flag and reason. It holds
  no user ID, email, credentials, Auth tokens or note data. Its storage events notify
  other tabs; the writing tab updates itself directly because it gets no such event.
- Frequent activity updates memory immediately, with storage writes batched at
  roughly one-second intervals and a trailing flush; activity near the previous
  deadline is written immediately. Route/page departure flushes the latest value.
  Browser storage is not transactional, so exactly simultaneous cross-tab actions
  still require testing; logout flags take priority over pending activity writes.
- Successful password login, immediate-session signup and the confirmation code
  callback set a fresh secure-notes-login cookie with login time and random UUID.
  This metadata is intentionally browser-readable and grants no access. It is not
  a session token. A new marker starts a fresh clock; regular reloads do not.
  For sessions established before this feature, the browser adopts/creates one
  marker once. Even absent timer storage, the login timestamp prevents an old login
  being restarted just by refreshing after its initial deadline has passed.
- When expired, the wrapper immediately hides its children, closes any open delete
  dialog and writes a logout flag. Other tabs hide too. Existing auth verification
  cannot reveal content while the logout flag is active. The UI says Signing out.
- expireIdleSession calls the shared existing SSR-compatible Supabase signOut with
  scope: local, clears the non-secret marker cookie and revalidates the root layout.
  It checks the expected marker so a stale tab does not intentionally sign out a
  newer login. Success uses a full replace navigation to /login?reason=inactive.
  That page displays exactly:
  Your session expired due to inactivity. Please log in again.
- Manual sign-out forms keep their original server action as a fallback. The
  mounted wrapper intercepts them to broadcast the lock and call the same shared
  SSR logout implementation, then redirects with the usual signed-out message.
  Late form submissions are blocked by the browser wrapper once locked. The real
  Server Actions still authenticate independently, regardless of browser checks.
- A failed/slow request leaves notes hidden and offers Retry sign out. No raw error,
  credential or note data is displayed. Denied cookie/storage access fails closed
  rather than quietly disabling the timeout. No successful server logout is claimed
  until the server action reports it. Another tab's new login reloads stale views.

## Client idle detection versus server enforcement

This is a client-side inactivity feature, not a server-maintained idle-session
policy. The server still verifies Supabase identity and RLS for every protected
operation, but does not independently measure user activity. A closed/suspended
browser cannot execute logout until it resumes, and a modified client can bypass
its own timer. Server-enforced idle revocation would need a separate design and
trusted session state; it was not added here. Copied access JWTs can remain valid
at a direct API until expiry. Logout cannot erase previously saved responses or
screenshots. Current no-store responses and browser-history guards remain in place.

localStorage coordination is limited to the same scheme, hostname and port.
localhost, 127.0.0.1, separate browser profiles and separate devices do not share
this timer. Local logout deliberately does not end other-device sessions.

## Manual browser tests (not executed by the assistant)

1. Log in using a disposable account. Do not click, type, move the pointer over the
   page or scroll. At two minutes expect notes hidden, Signing out, then the login
   page with the exact inactivity message. Do not use real tutoring records.
2. Log in again: a fresh two-minute window must start, not an immediate logout.
   Type, click, move the pointer, scroll or use touch every minute for several
   minutes. The session must remain active. Stop activity and wait two minutes.
3. After about 90 idle seconds refresh without interacting afterwards. The clock
   must retain its deadline rather than add a fresh two minutes. Keyboard refresh
   can itself be meaningful input if performed before expiry; use the browser
   toolbar/automation to test reload without page input. Repeat after expiry with
   a suspended tab: the old deadline must not be revived.
4. Navigate dashboard to editor and back. Normal clicks count as activity; route
   mounts alone must not. Notes create/update/delete should still work normally.
5. Hide/minimise the tab or suspend the laptop for more than two minutes. On return
   expect immediate locking/logout. Focus/pageshow/visibility are checks, not activity.
6. Open two tabs on the same origin. Activity in either must keep their shared
   session active. Stop activity in both for two minutes: both must lock. Repeat
   with one hidden, and switch back after expiration.
7. Manually Sign Out in one tab. Both tabs must hide their private views; on resume
   the hidden tab must check the logout record. Refresh, Back and Forward must not
   restore notes. Repeat with an open delete dialog and on an editor page.
8. Log in again while an old tab remains open. The fresh login marker must replace
   the expired clock; an old tab must reload rather than terminate the new login.
9. Block the logout request or go offline near expiry. Notes must stay hidden and
   a safe retry control appear (at most 15 seconds for a stalled request). Restore
   network, retry and confirm the login message. Do not assume offline UI locking
   means the remote session was revoked.
10. Check storage in local DevTools: only the documented metadata should appear in
    secure-notes:idle:v1. No credentials or note data belong there. Watch write
    frequency during continuous movement; it should be batched. Do not copy Auth
    cookies, tokens or credentials into reports. Login itself must have no timer.

## Local checks

Run npm.cmd run lint, npx.cmd --no-install tsc --noEmit, npm.cmd run build,
node --test tests/idle.test.mjs tests/idle-logout.test.mjs tests/notes.test.mjs,
and the existing auth tests. Idle tests use fake time/storage and mocked server
boundaries, not a real browser or live Supabase logout. No live session was expired
by these tests. Browser automation packages were not installed in this project.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event
- https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event
- https://supabase.com/docs/reference/javascript/auth-signout

## Verification results

Final lint, standalone TypeScript and production build passed without failures.
All 37 automated tests passed: 9 idle clock, 4 mocked SSR logout/login-marker,
14 note/action/page, 5 auth validation and 5 production HTTP smoke tests. The HTTP
checks include the exact inactivity notice and protected HTML/RSC redirects.
Node emitted the existing module-type detection warning for auth validator imports;
it did not affect tests. No browser interaction, real-time multi-tab test or live
Supabase logout test was run. The temporary production server was stopped.
