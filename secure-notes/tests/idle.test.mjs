import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/idle-session.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { IdleClock, IDLE_LIMIT_MS, parseIdleRecord } = exports;
function environment() {
  let now = 1000000;
  let raw = null;
  let writes = 0;
  const session = `${now}.non-secret-test-marker`;
  return {
    session,
    clock: marker => new IdleClock(marker ?? session, () => raw, value => { raw = value; writes++; }, () => now),
    advance: ms => { now += ms; },
    record: () => parseIdleRecord(raw),
    corrupt: () => { raw = "invalid-json"; },
    clear: () => { raw = null; },
    writes: () => writes,
    now: () => now,
  };
}

test("expires at exactly 120000ms and late activity cannot revive it", () => {
  assert.equal(IDLE_LIMIT_MS, 120000);
  const env = environment(); const clock = env.clock();
  assert.equal(clock.start(), "active");
  env.advance(119999); assert.equal(clock.check(), "active");
  env.advance(1); assert.equal(clock.activity(), "inactive");
  assert.equal(env.record().loggedOut, true);
});

test("trusted activity handler's clock method renews the deadline", () => {
  const env = environment(); const clock = env.clock(); clock.start();
  env.advance(60000); assert.equal(clock.activity(), "active");
  assert.equal(env.record().deadline, env.now() + 120000);
  env.advance(119999); assert.equal(clock.check(), "active");
  env.advance(1); assert.equal(clock.check(), "inactive");
});

test("mounting/refreshing preserves deadline and does not revive expiration", () => {
  const env = environment(); env.clock().start();
  env.advance(90000); const refreshed = env.clock();
  assert.equal(refreshed.start(), "active");
  assert.equal(refreshed.deadline, 1120000);
  env.advance(30000); assert.equal(env.clock().start(), "inactive");
});

test("hidden/suspended tab checks wall time instead of counting timer ticks", () => {
  const env = environment(); const clock = env.clock(); clock.start();
  env.advance(600000); assert.equal(clock.check(), "inactive");
});

test("tabs share activity, and both recognise manual/idle logout", () => {
  const env = environment(); const a = env.clock(); const b = env.clock();
  a.start(); b.start(); env.advance(60000); a.activity();
  assert.equal(b.check(), "active"); assert.equal(b.deadline, a.deadline);
  a.logout("manual"); assert.equal(b.activity(), "manual");
  assert.equal(b.flush(), "manual");
});

test("new successful-login marker creates a fresh timer; old tabs detect session change", () => {
  const env = environment(); const old = env.clock(); old.start();
  env.advance(120000); old.check();
  const fresh = env.clock(`${env.now()}.new-login-marker`);
  assert.equal(fresh.start(), "active");
  assert.equal(fresh.deadline, env.now() + 120000);
  assert.equal(old.check(), "changed"); assert.equal(old.flush(), "changed");
});

test("frequent movement batches writes and flush persists latest activity", () => {
  const env = environment(); const clock = env.clock(); clock.start();
  for (let i = 0; i < 90; i++) { env.advance(10); clock.activity(); }
  assert.equal(env.writes(), 1);
  clock.flush(); assert.equal(env.writes(), 2);
  assert.equal(env.record().deadline, env.now() + 120000);
});

test("deleted/corrupt storage cannot restart an expired login", () => {
  const env = environment(); const clock = env.clock(); clock.start();
  env.advance(120000); env.clear(); assert.equal(env.clock().start(), "inactive");
  env.corrupt(); assert.equal(clock.check(), "inactive");
  assert.equal(parseIdleRecord('{"deadline":"forever"}'), null);
});

test("a pending local activity write cannot overwrite a cross-tab logout", () => {
  const env = environment(); const a = env.clock(); const b = env.clock(); a.start(); b.start();
  env.advance(50); a.activity(); b.logout("inactive");
  assert.equal(a.flush(), "inactive"); assert.equal(env.record().loggedOut, true);
});
