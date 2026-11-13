export const IDLE_LIMIT_MS = 120000;
export const IDLE_STORAGE_KEY = "secure-notes:idle:v1";
export const IDLE_SESSION_COOKIE = "secure-notes-login";
export type LogoutReason = "inactive" | "manual";
export type IdleRecord = { session: string; deadline: number; loggedOut: boolean; reason: LogoutReason };
export type IdleStatus = "active" | "changed" | LogoutReason;

export function parseIdleRecord(raw: string | null): IdleRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (typeof value.session !== "string" || value.session.length > 100 ||
      !Number.isFinite(value.deadline) || value.deadline < 0 ||
      typeof value.loggedOut !== "boolean" || !["inactive", "manual"].includes(value.reason)) return null;
    return value;
  } catch { return null; }
}

// No browser dependencies: the clock/storage boundary is injectable for tests.
export class IdleClock {
  deadline = 0;
  private lastWrite = 0;
  private dirty = false;
  constructor(readonly session: string, private read: () => string | null,
    private write: (value: string) => void, private now: () => number = Date.now) {}

  private save(record: IdleRecord) {
    this.write(JSON.stringify(record));
    this.lastWrite = this.now();
    this.dirty = false;
  }

  start(): IdleStatus {
    const raw = this.read();
    const stored = parseIdleRecord(raw);
    if (raw !== null && !stored) return this.logout("inactive");
    if (!stored || stored.session !== this.session) {
      // Login time, not mount time: deleting storage/reloading cannot restart an old login.
      const loginTime = Number(this.session.split(".")[0]);
      this.deadline = Number.isFinite(loginTime) && loginTime > 0 ? loginTime + IDLE_LIMIT_MS : 0;
      this.save({ session: this.session, deadline: this.deadline, loggedOut: false, reason: "inactive" });
    } else this.deadline = stored.deadline;
    return this.check();
  }

  check(): IdleStatus {
    const stored = parseIdleRecord(this.read());
    if (!stored) return this.logout("inactive");
    if (stored.session !== this.session) return "changed";
    if (stored.loggedOut) return stored.reason;
    this.deadline = Math.max(this.deadline, stored.deadline);
    if (this.now() >= this.deadline) return this.logout("inactive");
    return "active";
  }

  activity(): IdleStatus {
    const status = this.check();
    // Late activity must not revive an already-expired session.
    if (status !== "active") return status;
    const stored = parseIdleRecord(this.read())!;
    this.deadline = this.now() + IDLE_LIMIT_MS;
    this.dirty = true;
    if (this.now() - this.lastWrite >= 1000 || stored.deadline - this.now() <= 1000) this.flush();
    return "active";
  }

  flush(): IdleStatus {
    const status = this.check();
    if (status !== "active") return status;
    if (this.dirty) this.save({ session: this.session, deadline: this.deadline, loggedOut: false, reason: "inactive" });
    return "active";
  }

  logout(reason: LogoutReason): IdleStatus {
    const stored = parseIdleRecord(this.read());
    if (stored && stored.session !== this.session) return "changed";
    this.save({ session: this.session, deadline: this.deadline, loggedOut: true, reason });
    return reason;
  }
}
