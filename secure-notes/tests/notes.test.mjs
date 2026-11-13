import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Run the real action/validator with mocked framework and database boundaries.
// This verifies control flow without connecting to Supabase or claiming RLS tests.
function load(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
  return exports;
}
const validation = load("../lib/notes-validation.ts");
function form(title, body) {
  const data = new FormData();
  if (title !== undefined) data.set("title", title);
  if (body !== undefined) data.set("body", body);
  return data;
}
function setup({ authenticated = true, dbError = false, throws = false, noMatch = false } = {}) {
  const calls = { auth: 0, inserts: [], changes: [], filters: [], revalidated: [] };
  const actions = load("../app/actions.ts", {
    "next/cache": { revalidatePath: path => calls.revalidated.push(path) },
    "next/navigation": { redirect: path => { throw new Error(`REDIRECT:${path}`); } },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({}) },
    "@/lib/notes-validation": validation,
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => { calls.auth++; return { data: { user: authenticated ? { id: "test-user" } : null }, error: null }; } },
      from: table => {
        assert.equal(table, "notes");
        const mutation = (operation, values) => {
          calls.changes.push({ operation, values });
          return { eq: (column, value) => {
            calls.filters.push([column, value]);
            return { select: columns => {
              assert.equal(columns, "id");
              return { maybeSingle: async () => {
                if (throws) throw new Error("sensitive network details");
                return { data: noMatch || dbError ? null : { id: value }, error: dbError ? { message: "sensitive SQL details" } : null };
              } };
            } };
          } };
        };
        return { update: values => mutation("update", values), delete: () => mutation("delete"), insert: async values => {
          calls.inserts.push(values);
          if (throws) throw new Error("sensitive network details");
          return { error: dbError ? { message: "sensitive SQL details" } : null };
        } };
      },
    }) },
  });
  return { ...actions, calls };
}
const initial = { status: "idle", message: "" };

test("blank, missing, file and oversized input never inserts", async () => {
  const { createNote, calls } = setup();
  for (const data of [form(), form(" \t\n"), form(new Blob(["title"])), form("ok", new Blob(["body"])), form("x".repeat(201)), form("ok", "x".repeat(20001))]) {
    assert.equal((await createNote(initial, data)).status, "error");
  }
  assert.equal(calls.inserts.length, 0);
  assert.equal(calls.revalidated.length, 0);
});

test("requires server authentication before inserting", async () => {
  const { createNote, calls } = setup({ authenticated: false });
  await assert.rejects(createNote(initial, form("Test")), /REDIRECT:\/login/);
  assert.equal(calls.auth, 1);
  assert.equal(calls.inserts.length, 0);
});

test("inserts only title/body, preserves plain text, and revalidates home", async () => {
  const { createNote, calls } = setup();
  const data = form(" Test ", "line 1\n<script>text only</script>");
  data.set("user_id", "attacker-selected-owner");
  assert.equal((await createNote(initial, data)).status, "success");
  assert.equal(calls.auth, 1);
  assert.equal(JSON.stringify(calls.inserts), JSON.stringify([{ title: "Test", body: "line 1\n<script>text only</script>" }]));
  assert.deepEqual(calls.revalidated, ["/"]);
});

test("omitted body becomes empty text", async () => {
  const { createNote, calls } = setup();
  assert.equal((await createNote(initial, form("Title"))).status, "success");
  assert.equal(calls.inserts[0].body, "");
});

test("database and network failures are safe errors without success revalidation", async () => {
  for (const options of [{ dbError: true }, { throws: true }]) {
    const { createNote, calls } = setup(options);
    const state = await createNote(initial, form("Title", "Body"));
    assert.equal(state.status, "error");
    assert.doesNotMatch(state.message, /sensitive/);
    assert.equal(calls.revalidated.length, 0);
  }
});

const noteId = "12345678-1234-4234-9234-123456789abc";
function editForm(id = noteId) {
  const data = form(" Changed title ", "Changed\nbody");
  if (id !== undefined) data.set("id", id);
  data.set("confirmation", "delete");
  return data;
}

test("UPDATE and DELETE both require authentication", async () => {
  for (const operation of ["updateNote", "deleteNote"]) {
    const context = setup({ authenticated: false });
    await assert.rejects(context[operation](initial, editForm()), /REDIRECT:\/login/);
    assert.equal(context.calls.auth, 1);
    assert.equal(context.calls.changes.length, 0);
  }
});

test("rejects invalid ID types and missing deletion confirmation without mutations", async () => {
  for (const operation of ["updateNote", "deleteNote"]) {
    for (const id of ["", "not-a-uuid", "1 OR 1=1", new Blob([noteId])]) {
      const context = setup();
      assert.equal((await context[operation](initial, editForm(id))).status, "error");
      assert.equal(context.calls.changes.length, 0);
    }
    const context = setup();
    const missing = editForm(); missing.delete("id");
    assert.equal((await context[operation](initial, missing)).status, "error");
    assert.equal(context.calls.changes.length, 0);
  }
  const context = setup();
  const data = editForm(); data.delete("confirmation");
  assert.equal((await context.deleteNote(initial, data)).status, "error");
  assert.equal(context.calls.changes.length, 0);
});

test("UPDATE reuses title/body validation", async () => {
  for (const data of [form(" \t\n"), form("Title", new Blob(["body"]))]) {
    data.set("id", noteId);
    const context = setup();
    assert.equal((await context.updateNote(initial, data)).status, "error");
    assert.equal(context.calls.changes.length, 0);
  }
});

test("UPDATE only changes allowed columns, targets ID, and revalidates both pages", async () => {
  const context = setup();
  const data = editForm(); data.set("user_id", "attacker-owner"); data.set("created_at", "fake");
  assert.equal((await context.updateNote(initial, data)).status, "success");
  const { values } = context.calls.changes[0];
  assert.deepEqual(Object.keys(values).sort(), ["body", "title", "updated_at"]);
  assert.equal(values.title, "Changed title");
  assert.equal(values.body, "Changed\nbody");
  assert.ok(Number.isFinite(Date.parse(values.updated_at)));
  assert.deepEqual(context.calls.filters, [["id", noteId]]);
  assert.deepEqual(context.calls.revalidated, ["/", `/notes/${noteId}`]);
  assert.equal(context.calls.auth, 1);
});

test("DELETE targets one ID and redirects only after success", async () => {
  const context = setup();
  await assert.rejects(context.deleteNote(initial, editForm()), /REDIRECT:\/\?message=note-deleted/);
  assert.equal(context.calls.changes[0].operation, "delete");
  assert.deepEqual(context.calls.filters, [["id", noteId]]);
  assert.deepEqual(context.calls.revalidated, ["/", `/notes/${noteId}`]);
});

test("zero matched rows, database and network failures cannot announce successful mutations", async () => {
  for (const options of [{ noMatch: true }, { dbError: true }, { throws: true }]) {
    for (const operation of ["updateNote", "deleteNote"]) {
      const context = setup(options);
      const result = await context[operation](initial, editForm());
      assert.equal(result.status, "error");
      assert.doesNotMatch(result.message, /sensitive/);
      assert.equal(context.calls.revalidated.length, 0);
    }
  }
});

function editPage({ note = null, dbError = false } = {}) {
  const calls = { auth: 0, reads: 0 };
  const { default: page } = load("../app/notes/[id]/page.tsx", {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "next/link": () => null,
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
    "@/lib/notes-validation": validation,
    "@/lib/supabase/auth": { requireUser: async () => { calls.auth++; return { id: "owner" }; } },
    "@/app/components/private-content": { PrivateContent: () => null },
    "@/app/login/actions": { signOut: () => null },
    "@/app/components/edit-note-form": { EditNoteForm: () => null },
    "@/app/components/delete-note-button": { DeleteNoteButton: () => null },
    "@/app/components/submit-button": { SubmitButton: () => null },
    "@/app/components/dashboard-header": { DashboardHeader: () => null },
    "@/lib/supabase/server": { createClient: async () => ({ from: table => {
      assert.equal(table, "notes");
      calls.reads++;
      return { select: columns => {
        assert.equal(columns, "id, title, body");
        return { eq: (column, value) => {
          assert.equal(column, "id"); assert.equal(value, noteId);
          return { maybeSingle: async () => ({ data: note, error: dbError ? { message: "sensitive SQL error" } : null }) };
        } };
      } };
    } }) },
  });
  return { page, calls };
}

test("edit page authenticates then rejects malformed IDs before querying", async () => {
  const { page, calls } = editPage();
  await assert.rejects(page({ params: Promise.resolve({ id: "bad-id" }) }), /NOT_FOUND/);
  assert.equal(calls.auth, 1);
  assert.equal(calls.reads, 0);
});

test("edit page treats an RLS-hidden or missing row as Not Found", async () => {
  const { page, calls } = editPage();
  await assert.rejects(page({ params: Promise.resolve({ id: noteId }) }), /NOT_FOUND/);
  assert.equal(calls.auth, 1);
  assert.equal(calls.reads, 1);
});

test("edit page prefills returned note but reports database failures without raw detail", async () => {
  const note = { id: noteId, title: "Current title", body: "Current\nbody" };
  const context = editPage({ note });
  const tree = await context.page({ params: Promise.resolve({ id: noteId }) });
  assert.match(JSON.stringify(tree), /Current title/);
  assert.match(JSON.stringify(tree), /Current\\nbody/);
  await assert.rejects(editPage({ dbError: true }).page({ params: Promise.resolve({ id: noteId }) }), { message: "Unable to load note." });
});

function dashboardContext({ readError = false, countError = false, initialNotes = [], listLimit = Infinity } = {}) {
  const notes = [...initialNotes];
  const calls = { revalidated: [], orders: [], filters: [] };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "fictional-tutor" } }, error: null }) },
    from: table => {
      assert.equal(table, "notes");
      const mutation = values => ({ eq: (column, id) => {
        assert.equal(column, "id");
        return { select: columns => {
          assert.equal(columns, "id");
          return { maybeSingle: async () => {
            const index = notes.findIndex(note => note.id === id);
            if (index < 0) return { data: null, error: null };
            if (values) notes[index] = { ...notes[index], ...values };
            else notes.splice(index, 1);
            return { data: { id }, error: null };
          } };
        } };
      } });
      return {
        update: values => mutation(values),
        delete: () => mutation(null),
        insert: async values => {
          assert.deepEqual(Object.keys(values).sort(), ["body", "title"]);
          notes.unshift({ ...values, id: noteId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          return { error: null };
        },
        select: (columns, options) => {
          if (options?.head) {
            assert.equal(columns, "id"); assert.equal(options.count, "exact");
            let lower; let upper;
            const query = {
              gte: (column, value) => { assert.equal(column, "updated_at"); lower = value; calls.filters.push(["gte", value]); return query; },
              lte: (column, value) => { assert.equal(column, "updated_at"); upper = value; calls.filters.push(["lte", value]); return query; },
              then: (resolve, reject) => Promise.resolve({ count: countError ? null : notes.filter(note => (!lower || note.updated_at >= lower) && (!upper || note.updated_at <= upper)).length, error: countError ? { message: "private count detail" } : null }).then(resolve, reject),
            };
            return query;
          }
          assert.equal(columns, "id, title, body, created_at");
          return { order: async (column, options) => {
            calls.orders.push([column, options.ascending]);
            return { data: readError ? null : notes.slice(0, listLimit), error: readError ? { message: "private database detail" } : null };
          } };
        },
      };
    },
  };
  const components = {
    PrivateContent: function PrivateContent() {},
    DashboardHeader: function DashboardHeader() {},
    NewNoteForm: function NewNoteForm() {},
    NoteCard: function NoteCard() {},
    ActionFeedback: function ActionFeedback() {},
    DashboardStats: function DashboardStats() {},
    WorkspaceIcon: function WorkspaceIcon() {},
  };
  const shared = {
    "@/lib/supabase/server": { createClient: async () => client },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  };
  const { default: home } = load("../app/page.tsx", {
    ...shared,
    "@/lib/supabase/auth": { requireUser: async () => ({ id: "fictional-tutor", email: "tutor@fictional.example" }) },
    "./components/private-content": { PrivateContent: components.PrivateContent },
    "./components/dashboard-header": { DashboardHeader: components.DashboardHeader },
    "./components/new-note-form": { NewNoteForm: components.NewNoteForm },
    "./components/note-card": { NoteCard: components.NoteCard },
    "./components/action-feedback": { ActionFeedback: components.ActionFeedback },
    "./components/dashboard-stats": { DashboardStats: components.DashboardStats },
    "./components/workspace-icon": { WorkspaceIcon: components.WorkspaceIcon },
  });
  const actions = load("../app/actions.ts", {
    ...shared,
    "next/cache": { revalidatePath: path => calls.revalidated.push(path) },
    "next/navigation": { redirect: path => { throw new Error(`REDIRECT:${path}`); } },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({}) },
    "@/lib/notes-validation": validation,
  });
  return { home: () => home({ searchParams: Promise.resolve({}) }), ...actions, components, calls };
}

function findComponents(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(value => findComponents(value, type));
  return [...(tree.type === type ? [tree] : []), ...findComponents(tree.props?.children, type)];
}

test("authenticated root page renders the dashboard header and new-note form", async () => {
  const context = dashboardContext();
  const tree = await context.home();
  assert.equal(tree.type, context.components.PrivateContent);
  assert.equal(tree.props.userId, "fictional-tutor");
  assert.equal(findComponents(tree, context.components.DashboardHeader)[0].props.email, "tutor@fictional.example");
  assert.equal(findComponents(tree, context.components.NewNoteForm).length, 1);
  assert.match(JSON.stringify(tree), /Welcome back!/);
});

test("successful note creation revalidates root and the next dashboard render includes its card", async () => {
  const context = dashboardContext();
  assert.equal(findComponents(await context.home(), context.components.NoteCard).length, 0);
  const state = await context.createNote(initial, form("Dashboard render test", "Fictional note"));
  assert.equal(state.status, "success");
  assert.deepEqual(context.calls.revalidated, ["/"]);
  const cards = findComponents(await context.home(), context.components.NoteCard);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].props.note.title, "Dashboard render test");
  assert.equal(cards[0].props.note.body, "Fictional note");
  const stats = findComponents(await context.home(), context.components.DashboardStats)[0].props;
  assert.equal(stats.total, 1); assert.equal(stats.recent, 1);
  assert.ok(context.calls.orders.every(([column, ascending]) => column === "created_at" && ascending === false));
});

test("dashboard read failures show safe feedback rather than an empty-state claim", async () => {
  const context = dashboardContext({ readError: true });
  const tree = await context.home();
  const feedback = findComponents(tree, context.components.ActionFeedback);
  assert.ok(feedback.some(node => node.props.status === "error"));
  assert.doesNotMatch(JSON.stringify(tree), /private database detail|A fresh page for your next lesson/);
});

test("statistics use exact counts independently of the loaded-card limit and updated_at window", async () => {
  const time = days => new Date(Date.now() - days * 86400000).toISOString();
  const context = dashboardContext({ listLimit: 1, initialNotes: [
    { id: noteId, title: "Old creation, recent edit", body: "", created_at: time(40), updated_at: time(1) },
    { id: "22222222-2222-4222-8222-222222222222", title: "Old edit", body: "", created_at: time(40), updated_at: time(8) },
    { id: "33333333-3333-4333-8333-333333333333", title: "Future timestamp", body: "", created_at: time(40), updated_at: time(-1) },
  ] });
  const tree = await context.home();
  assert.equal(findComponents(tree, context.components.NoteCard).length, 1);
  const stats = findComponents(tree, context.components.DashboardStats)[0].props;
  assert.equal(stats.total, 3); assert.equal(stats.recent, 1);
  const lower = context.calls.filters.find(([operation]) => operation === "gte")[1];
  const upper = context.calls.filters.find(([operation]) => operation === "lte")[1];
  assert.equal(Date.parse(upper) - Date.parse(lower), 7 * 86400000);
});

test("failed count queries render unavailable statistics without hiding successfully loaded notes", async () => {
  const context = dashboardContext({ countError: true });
  const tree = await context.home();
  const stats = findComponents(tree, context.components.DashboardStats)[0].props;
  assert.equal(stats.total, null); assert.equal(stats.recent, null);
  assert.ok(findComponents(tree, context.components.ActionFeedback).some(node => /statistics/.test(node.props.message)));
  assert.doesNotMatch(JSON.stringify(tree), /private count detail/);
});

test("editing and deleting refresh the actual statistics on the next dashboard render", async () => {
  const old = new Date(Date.now() - 10 * 86400000).toISOString();
  const context = dashboardContext({ initialNotes: [{ id: noteId, title: "Original", body: "", created_at: old, updated_at: old }] });
  assert.equal(findComponents(await context.home(), context.components.DashboardStats)[0].props.recent, 0);
  assert.equal((await context.updateNote(initial, editForm())).status, "success");
  let stats = findComponents(await context.home(), context.components.DashboardStats)[0].props;
  assert.equal(stats.total, 1); assert.equal(stats.recent, 1);
  await assert.rejects(context.deleteNote(initial, editForm()), /REDIRECT:\/\?message=note-deleted/);
  stats = findComponents(await context.home(), context.components.DashboardStats)[0].props;
  assert.equal(stats.total, 0); assert.equal(stats.recent, 0);
});
