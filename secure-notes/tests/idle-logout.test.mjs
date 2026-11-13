import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function setup({ marker = "1000000.current-login", fail = false } = {}) {
  const calls = { signOut: [], revalidated: [], deleted: [], freshLogins: 0 };
  const source = readFileSync(new URL("../app/login/actions.ts", import.meta.url), "utf8");
  const imports = {
    "next/cache": { revalidatePath: (...args) => calls.revalidated.push(args) },
    "next/navigation": { redirect: path => { throw new Error(`REDIRECT:${path}`); } },
    "next/headers": { headers: async () => new Map(), cookies: async () => ({
      get: () => marker ? { value: marker } : undefined,
      delete: name => calls.deleted.push(name),
    }) },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({}) },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      signOut: async options => { calls.signOut.push(options); return { error: fail ? {} : null }; },
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ data: { session: {} }, error: null }),
    } }) },
    "@/lib/supabase/validation": { readCredentials: () => ({ email: "fictional@example.com", password: "test-only" }), signupMessageCode: () => "signup-failed" },
    "@/lib/supabase/login-marker": { startIdleSession: async () => { calls.freshLogins++; } },
    "@/lib/idle-session": { IDLE_SESSION_COOKIE: "secure-notes-login" },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return { ...exports, calls };
}

test("idle logout reuses scoped SSR signOut, clears marker and invalidates layout", async () => {
  const context = setup();
  assert.equal((await context.expireIdleSession("1000000.current-login")).ok, true);
  assert.equal(context.calls.signOut[0].scope, "local");
  assert.deepEqual(context.calls.deleted, ["secure-notes-login"]);
  assert.deepEqual(context.calls.revalidated, [["/", "layout"]]);
});

test("a stale tab cannot sign out a newer login marker", async () => {
  const context = setup();
  const result = await context.expireIdleSession("900000.old-login");
  assert.equal(result.superseded, true);
  assert.equal(context.calls.signOut.length, 0);
});

test("failed logout does not claim success or discard the retry marker", async () => {
  const context = setup({ fail: true });
  assert.equal((await context.expireIdleSession("1000000.current-login")).ok, false);
  assert.equal(context.calls.deleted.length, 0);
  assert.equal(context.calls.revalidated.length, 0);
});

test("successful login and immediate signup initialise a fresh inactivity marker", async () => {
  const context = setup();
  await assert.rejects(context.logIn(new FormData()), { message: "REDIRECT:/" });
  await assert.rejects(context.signUp(new FormData()), { message: "REDIRECT:/" });
  assert.equal(context.calls.freshLogins, 2);
});
