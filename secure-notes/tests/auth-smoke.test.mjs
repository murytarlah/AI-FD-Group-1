import test from "node:test";
import assert from "node:assert/strict";

// Start the app separately. No Supabase keys or real accounts are needed.
const base = process.env.AUTH_TEST_URL || "http://127.0.0.1:3100";

test("inactivity redirects have the required login notice", async () => {
  const response = await fetch(base + "/login?reason=inactive");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Your session expired due to inactivity\. Please log in again\./);
});

test("signed-out requests cannot receive protected pages, including RSC requests", async () => {
  for (const path of ["/", "/notes/test-id"]) {
    for (const headers of [{}, { RSC: "1" }]) {
      const response = await fetch(base + path, { headers, redirect: "manual" });
      assert.equal(response.status, 303);
      assert.equal(new URL(response.headers.get("location"), base).pathname, "/login");
      assert.match(response.headers.get("cache-control"), /private.*no-store/);
      assert.doesNotMatch(await response.text(), /Signed in as/);
    }
  }
});

test("login is available, uncached, and never reflects arbitrary message text", async () => {
  const response = await fetch(base + "/login?message=arbitrary-user-input");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  const html = await response.text();
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /role="status"[^>]*>arbitrary-user-input/);
});

test("server action validates a direct invalid login POST without browser validation", async () => {
  const html = await (await fetch(base + "/login")).text();
  const actionName = html.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(actionName, "Expected the default login Server Action form field");
  const body = new FormData();
  body.set(actionName, "");
  body.set("email", "not-an-email");
  body.set("password", "");
  const response = await fetch(base + "/login", {
    method: "POST", headers: { Origin: base }, body, redirect: "manual",
  });
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location"), base).searchParams.get("message"), "invalid-login");
  const errorPage = await (await fetch(base + "/login?message=invalid-login")).text();
  assert.match(errorPage, />Wrong email or password<\/p>/);
});

test("missing confirmation code fails safely to a fixed local login destination", async () => {
  const response = await fetch(base + "/auth/callback?next=https://example.com", { redirect: "manual" });
  assert.equal(response.status, 303);
  const destination = new URL(response.headers.get("location"), base);
  assert.equal(destination.origin, new URL(base).origin);
  assert.equal(destination.pathname, "/login");
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
});
