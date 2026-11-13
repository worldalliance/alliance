import { expect, test } from "bun:test";
import { describeProblems } from "./report";
import type { Captured } from "./spool";

const request = (fields: Partial<Captured>): Captured => ({
  key: "claude/a.jsonl",
  file: "/t/a.jsonl",
  path: "/s/requests/1.json",
  ageMs: 0,
  ...fields,
});

const logFile = "/s/worker.log";

test("says nothing while every request is young and none failed", () => {
  const listing = { requests: [request({})], unreadable: [] };
  expect(
    describeProblems({ listing, workerError: undefined, logFile }),
  ).toBeUndefined();
});

test("names each failed key once, after its cause's group", () => {
  const listing = {
    requests: [
      request({ error: "ExpiredToken" }),
      request({ ageMs: 2 * 60 * 60_000 }),
    ],
    unreadable: [],
  };
  const warning = describeProblems({
    listing,
    workerError: undefined,
    logFile,
  });
  expect(warning).toContain("Upload failed for claude/a.jsonl: ExpiredToken");
  expect(warning).not.toContain("Not confirmed");
});

test("joins unconfirmed, unreadable and worker failures into one warning", () => {
  const listing = {
    requests: [request({ key: "codex/b.jsonl", ageMs: 2 * 60 * 60_000 })],
    unreadable: ["/s/requests/junk.json (bad JSON)"],
  };
  const warning = describeProblems({
    listing,
    workerError: "disk full",
    logFile,
  });
  expect(warning).toContain(
    `Not confirmed after an hour, so check ${logFile}: codex/b.jsonl`,
  );
  expect(warning).toContain(
    "Unreadable, so delete them: /s/requests/junk.json (bad JSON)",
  );
  expect(warning).toContain("The uploader failed: disk full");
});

test("names only the first three unreadable requests", () => {
  const unreadable = ["a", "b", "c", "d", "e"].map((name) => `/s/${name}.json`);
  const warning = describeProblems({
    listing: { requests: [], unreadable },
    workerError: undefined,
    logFile,
  });
  expect(warning).toBe(
    "Unreadable, so delete them: /s/a.json, /s/b.json, /s/c.json and 2 more",
  );
});

test("groups keys that share a cause and names only the first three", () => {
  const listing = {
    requests: [
      ...["a", "b", "c", "d", "e"].map((name) =>
        request({ key: `claude/${name}.jsonl`, error: "no profile" }),
      ),
      request({ key: "codex/f.jsonl", error: "AccessDenied" }),
    ],
    unreadable: [],
  };
  expect(describeProblems({ listing, workerError: undefined, logFile })).toBe(
    "Upload failed for claude/a.jsonl, claude/b.jsonl, claude/c.jsonl and 2 more: no profile. Upload failed for codex/f.jsonl: AccessDenied",
  );
});

test("names every key of a group when asked to", () => {
  const listing = {
    requests: ["a", "b", "c", "d"].map((name) =>
      request({ key: `claude/${name}.jsonl`, error: "gone" }),
    ),
    unreadable: [],
  };
  expect(
    describeProblems({
      listing,
      workerError: undefined,
      logFile,
      everyKey: true,
    }),
  ).toBe(
    "Upload failed for claude/a.jsonl, claude/b.jsonl, claude/c.jsonl, claude/d.jsonl: gone",
  );
});

test("leaves out a cause the caller already stated", () => {
  const listing = {
    requests: [request({ error: "ExpiredToken" })],
    unreadable: [],
  };
  expect(
    describeProblems({
      listing,
      workerError: undefined,
      logFile,
      statedCause: "ExpiredToken",
    }),
  ).toBe("Upload failed for claude/a.jsonl for the same reason");
});

test("reads as the last attempt's when the caller just started a retry", () => {
  const listing = {
    requests: [request({ error: "ExpiredToken", credentialsFailed: true })],
    unreadable: [],
  };
  expect(
    describeProblems({
      listing,
      workerError: undefined,
      logFile,
      retrying: true,
    }),
  ).toBe(
    "The last upload attempt failed for claude/a.jsonl: ExpiredToken; retrying now",
  );
});
