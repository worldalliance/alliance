import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Conversation } from "../shared/conversation";
import { ConversationStore, conversationTitle } from "./conversations";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function storeFile(): string {
  dir = mkdtempSync(path.join(tmpdir(), "conversations-"));
  return path.join(dir, "nested", "conversations.json");
}

const conversation = (id: string): Conversation => ({
  id,
  folder: "/work",
  title: `Conversation ${id}`,
  startedAt: "2026-11-10T12:00:00.000Z",
});

describe("ConversationStore", () => {
  test("lists nothing before the first conversation", async () => {
    expect(await new ConversationStore(storeFile()).list()).toEqual({
      ok: true,
      value: [],
    });
  });

  test("lists conversations newest first, across instances", async () => {
    const file = storeFile();
    const store = new ConversationStore(file);
    await store.add(conversation("a"));
    await store.add(conversation("b"));
    const listed = await new ConversationStore(file).list();
    expect(listed.ok && listed.value.map((c) => c.id)).toEqual(["b", "a"]);
  });

  test("finds a conversation by id", async () => {
    const store = new ConversationStore(storeFile());
    await store.add(conversation("a"));
    expect(await store.find("a")).toEqual({
      ok: true,
      value: conversation("a"),
    });
    expect(await store.find("z")).toEqual({ ok: true, value: undefined });
  });

  test("a file it can't read names the file", async () => {
    const file = storeFile();
    mkdirSync(file, { recursive: true });
    const listed = await new ConversationStore(file).find("a");
    expect(!listed.ok && listed.error.message).toBe(
      `Can't read ${file}: EISDIR: illegal operation on a directory, read`,
    );
  });

  test("a title is the first message on one line, shortened", () => {
    expect(conversationTitle("  Fix the\n  login   page  ")).toBe(
      "Fix the login page",
    );
    expect(conversationTitle("x".repeat(100))).toHaveLength(80);
    expect(conversationTitle(`${"x".repeat(79)}😀 rest`)).toBe(
      `${"x".repeat(79)}😀`,
    );
    expect(conversationTitle(`${"x".repeat(79)}🇺🇸 rest`)).toBe(
      `${"x".repeat(79)}🇺🇸`,
    );
    expect(conversationTitle(`${"x".repeat(79)}e\u0301 rest`)).toBe(
      `${"x".repeat(79)}e\u0301`,
    );
  });

  test("concurrent writes all land", async () => {
    const store = new ConversationStore(storeFile());
    await Promise.all(["a", "b", "c"].map((id) => store.add(conversation(id))));
    const listed = await store.list();
    expect(listed.ok && listed.value.map((c) => c.id).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("a write that throws doesn't stop later writes", async () => {
    const store = new ConversationStore(storeFile());
    const thrown = store["update"](() => {
      throw new Error("boom");
    });
    await expect(thrown).rejects.toThrow("boom");
    expect((await store.add(conversation("a"))).ok).toBe(true);
  });

  test("a file that isn't a conversation list fails rather than reading as empty", async () => {
    const file = storeFile();
    const store = new ConversationStore(file);
    await store.add(conversation("a"));
    writeFileSync(file, "{ not json");
    const listed = await store.list();
    expect(listed.ok).toBe(false);
    expect(!listed.ok && listed.error.message).toContain(
      "isn't a conversation list",
    );
    expect((await store.add(conversation("b"))).ok).toBe(false);
    expect(readFileSync(file, "utf8")).toBe("{ not json");
  });

  test("a list that fails its schema says which field, readably", async () => {
    const file = storeFile();
    mkdirSync(path.dirname(file));
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        conversations: [{ id: "a", folder: "/w", title: "t" }],
      }),
    );
    const listed = await new ConversationStore(file).list();
    expect(!listed.ok && listed.error.message).toContain(
      "at conversations[0].startedAt",
    );
    expect(!listed.ok && listed.error.message).not.toContain('"code"');
  });

  test("a start time that isn't an ISO date fails", async () => {
    const file = storeFile();
    mkdirSync(path.dirname(file));
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        conversations: [{ ...conversation("a"), startedAt: "yesterday" }],
      }),
    );
    const listed = await new ConversationStore(file).list();
    expect(!listed.ok && listed.error.message).toContain(
      "at conversations[0].startedAt",
    );
  });
});
