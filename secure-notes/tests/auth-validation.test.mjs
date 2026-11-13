import test from "node:test";
import assert from "node:assert/strict";
import { readCredentials, signupMessageCode } from "../lib/supabase/validation.ts";

function form(email, password) {
  const data = new FormData();
  if (email !== undefined) data.set("email", email);
  if (password !== undefined) data.set("password", password);
  return data;
}

test("signup failures give safe actionable feedback without account enumeration", () => {
  assert.equal(signupMessageCode("over_email_send_rate_limit", 429), "signup-rate-limit");
  assert.equal(signupMessageCode("weak_password", 422), "signup-password-policy");
  assert.equal(signupMessageCode("email_address_not_authorized", 403), "signup-email-delivery");
  assert.equal(signupMessageCode("signup_disabled", 422), "signup-unavailable");
  assert.equal(signupMessageCode(undefined, 0), "signup-connection");
  assert.equal(signupMessageCode(undefined, 401), "signup-configuration");
  for (const code of ["email_exists", "user_already_exists", "user_not_found", "unknown_raw_error"]) {
    assert.equal(signupMessageCode(code, 422), "signup-failed");
  }
});

test("signup requires email and at least eight password characters", () => {
  for (const email of [undefined, "", "bad", "a@b", "a b@example.com"]) {
    assert.equal(readCredentials(form(email, "password123"), true), null);
  }
  for (const password of [undefined, "", "1234567"]) {
    assert.equal(readCredentials(form("a@example.com", password), true), null);
  }
  assert.ok(readCredentials(form("a@example.com", "12345678"), true));
});

test("email is trimmed but password is preserved exactly", () => {
  assert.deepEqual(readCredentials(form(" a@example.com ", " secret "), true), {
    email: "a@example.com", password: " secret ",
  });
});

test("login accepts existing short passwords and rejects empty input", () => {
  assert.ok(readCredentials(form("a@example.com", "short"), false));
  assert.equal(readCredentials(form("a@example.com", ""), false), null);
});

test("rejects uploaded files and excessively long values", () => {
  assert.equal(readCredentials(form(new Blob(["a@example.com"]), "password123"), true), null);
  assert.equal(readCredentials(form("a@example.com", new Blob(["password123"])), true), null);
  assert.equal(readCredentials(form("a@example.com", "x".repeat(1025)), true), null);
  assert.equal(readCredentials(form("x".repeat(250) + "@example.com", "password123"), true), null);
});
