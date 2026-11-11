import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { R } from "../../common/src/result";
import {
  discard,
  drain,
  listRequests,
  publish,
  runPass,
  takeWake,
  type UploadRequest,
  wakeSet,
} from "./spool";

let dir: string;
let transcript: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "spool-"));
  transcript = join(dir, "session.jsonl");
  writeFileSync(transcript, "{}\n");
});

afterEach(() => {
  chmodSync(dir, 0o700);
  if (existsSync(join(dir, "requests")))
    chmodSync(join(dir, "requests"), 0o700);
  rmSync(dir, { recursive: true });
});

const requests = () => R.unwrap(listRequests(dir)).requests;
const ok = async () => R.success(undefined);
const goneCause = "gone";
const unexpected = (error: Error) => {
  throw error;
};

test("each publish adds a request of its own and sets the wakeup marker", () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  expect(requests()).toHaveLength(2);
  expect(R.unwrap(takeWake(dir))).toBe(true);
  expect(R.unwrap(takeWake(dir))).toBe(false);
});

test("a publish that cannot set the wakeup marker still records its request", () => {
  mkdirSync(join(dir, "wake"));
  const published = R.unwrap(
    publish(dir, { key: "claude/a.jsonl", file: transcript }),
  );
  expect(published.wakeError?.message).toContain("wake");
  expect(requests()).toMatchObject([{ key: "claude/a.jsonl" }]);
});

test("a publish that cannot record its request fails", () => {
  writeFileSync(join(dir, "requests"), "");
  expect(publish(dir, { key: "claude/a.jsonl", file: transcript }).ok).toBe(
    false,
  );
  expect(existsSync(join(dir, "wake"))).toBe(false);
});

test("takeWake fails when the marker cannot be cleared", () => {
  mkdirSync(join(dir, "wake"));
  writeFileSync(join(dir, "wake", "x"), "");
  expect(takeWake(dir).ok).toBe(false);
});

test("a listing reports a request it cannot parse and skips temp files", () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  writeFileSync(join(dir, "requests", "junk.json"), "not json");
  writeFileSync(join(dir, "requests", "x.json.1.tmp"), "partial");
  const listing = R.unwrap(listRequests(dir));
  expect(listing.requests).toHaveLength(1);
  expect(listing.unreadable).toEqual([
    expect.stringContaining(join(dir, "requests", "junk.json")),
  ]);
});

test("a listing names a malformed request's fields on one line", () => {
  mkdirSync(join(dir, "requests"));
  writeFileSync(join(dir, "requests", "bad.json"), '{"key":1}');
  const [entry] = R.unwrap(listRequests(dir)).unreadable;
  expect(entry).toStartWith(`${join(dir, "requests", "bad.json")} (key: `);
  expect(entry).toContain("file: ");
  expect(entry).not.toContain("\n");
});

test("a listing reports a request it cannot read", () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  const [file] = readdirSync(join(dir, "requests"));
  chmodSync(join(dir, "requests", file), 0o000);
  const listing = R.unwrap(listRequests(dir));
  expect(listing.requests).toEqual([]);
  expect(listing.unreadable).toEqual([
    expect.stringContaining(`${join(dir, "requests", file)} (EACCES`),
  ]);
});

test("a spool it cannot search fails the listing", () => {
  const parent = join(dir, "parent");
  const spool = join(parent, "spool");
  R.unwrap(publish(spool, { key: "claude/a.jsonl", file: transcript }));
  chmodSync(parent, 0o000);
  const listing = listRequests(spool);
  chmodSync(parent, 0o700);
  expect(listing.ok).toBe(false);
});

test("a missing spool lists nothing", () => {
  expect(R.unwrap(listRequests(join(dir, "none")))).toEqual({
    requests: [],
    unreadable: [],
  });
});

test("a pass uploads each key once and deletes only the requests it captured", async () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  const uploaded: UploadRequest[] = [];
  const pass = await runPass({
    dir,
    goneCause,
    upload: async (request) => {
      uploaded.push(request);
      R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
      return R.success(undefined);
    },
  });
  expect(pass.ok).toBe(true);
  expect(uploaded).toEqual([{ key: "claude/a.jsonl", file: transcript }]);
  expect(requests()).toMatchObject([{ key: "claude/a.jsonl" }]);
});

test("a failed upload keeps its request with the cause and other keys still upload", async () => {
  const other = join(dir, "other.jsonl");
  writeFileSync(other, "{}\n");
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  R.unwrap(publish(dir, { key: "claude/b.jsonl", file: other }));
  const pass = await runPass({
    dir,
    goneCause,
    upload: async ({ key }) =>
      key === "claude/a.jsonl"
        ? R.failure("ExpiredToken")
        : R.success(undefined),
  });
  expect(pass.ok).toBe(true);
  expect(requests()).toMatchObject([
    { key: "claude/a.jsonl", file: transcript, error: "ExpiredToken" },
  ]);
});

test("a key that keeps failing holds one request with the latest cause", async () => {
  for (const cause of ["ExpiredToken", "NetworkError"]) {
    R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
    R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
    await runPass({ dir, goneCause, upload: async () => R.failure(cause) });
  }
  expect(requests()).toMatchObject([
    { key: "claude/a.jsonl", error: "NetworkError" },
  ]);
});

test("the newest request by mtime is the one uploaded, however slowly the listing reads", async () => {
  mkdirSync(join(dir, "requests"));
  for (const [older, newer] of [
    ["a", "b"],
    ["b", "a"],
  ]) {
    for (const [name, at] of [
      [older, 1_000_000],
      [newer, 1_000_003],
    ] as const) {
      const file = join(dir, `${name}.jsonl`);
      writeFileSync(file, "{}\n");
      const request = join(dir, "requests", `${name}.json`);
      writeFileSync(request, JSON.stringify({ key: "claude/k.jsonl", file }));
      utimesSync(request, at / 1000, at / 1000);
    }
    let now = 2_000_000;
    const clock = spyOn(Date, "now").mockImplementation(() => (now += 5));
    const uploaded: string[] = [];
    await runPass({
      dir,
      goneCause,
      upload: async ({ file }) => {
        uploaded.push(file);
        return R.success(undefined);
      },
    });
    clock.mockRestore();
    expect(uploaded).toEqual([join(dir, `${newer}.jsonl`)]);
  }
});

test("a failed upload keeps its request older than one published during it", async () => {
  const older = join(dir, "older.jsonl");
  const newer = join(dir, "newer.jsonl");
  writeFileSync(older, "{}\n");
  writeFileSync(newer, "{}\n");
  R.unwrap(publish(dir, { key: "claude/k.jsonl", file: older }));
  const [first] = readdirSync(join(dir, "requests"));
  const hourAgo = new Date(Date.now() - 3_600_000);
  utimesSync(join(dir, "requests", first), hourAgo, hourAgo);
  await runPass({
    dir,
    goneCause,
    upload: async () => {
      R.unwrap(publish(dir, { key: "claude/k.jsonl", file: newer }));
      return R.failure("offline");
    },
  });
  const uploaded: string[] = [];
  await runPass({
    dir,
    goneCause,
    upload: async ({ file }) => {
      uploaded.push(file);
      return R.success(undefined);
    },
  });
  expect(uploaded).toEqual([newer]);
});

test("a pass deletes temp files older than a minute and keeps newer ones", async () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  const stale = join(dir, "requests", "x.json.1.tmp");
  const fresh = join(dir, "requests", "x.json.2.tmp");
  writeFileSync(stale, "partial");
  writeFileSync(fresh, "partial");
  const hourAgo = new Date(Date.now() - 3_600_000);
  utimesSync(stale, hourAgo, hourAgo);
  expect(await runPass({ dir, goneCause, upload: ok })).toEqual(
    R.success(undefined),
  );
  expect(readdirSync(join(dir, "requests"))).toEqual(["x.json.2.tmp"]);
});

test("deleted transcripts keep the caller's cause without an upload", async () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  R.unwrap(publish(dir, { key: "claude/b.jsonl", file: transcript }));
  rmSync(transcript);
  let called = false;
  await runPass({
    dir,
    goneCause,
    upload: async () => {
      called = true;
      return R.success(undefined);
    },
  });
  expect(called).toBe(false);
  const [a, b] = requests();
  expect(a.error).toBe(goneCause);
  expect(b.error).toBe(goneCause);
});

test("a transcript that can't be checked uploads and records the upload's cause", async () => {
  const locked = join(dir, "locked");
  mkdirSync(locked);
  const file = join(locked, "session.jsonl");
  writeFileSync(file, "{}\n");
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file }));
  chmodSync(locked, 0o000);
  let called = false;
  await runPass({
    dir,
    goneCause,
    upload: async () => {
      called = true;
      return R.failure("EACCES");
    },
  });
  chmodSync(locked, 0o700);
  expect(called).toBe(true);
  expect(requests()).toMatchObject([{ error: "EACCES" }]);
});

test("a pass that cannot record a failure fails and leaves the request", async () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  chmodSync(join(dir, "requests"), 0o500);
  const pass = await runPass({
    dir,
    goneCause,
    upload: async () => R.failure("denied"),
  });
  expect(pass.ok).toBe(false);
  expect(pass.ok ? "" : pass.error.message).toContain("could not update");
  expect(requests()).toMatchObject([{ key: "claude/a.jsonl" }]);
  expect(requests()[0].error).toBeUndefined();
});

test("a pass that cannot delete an uploaded request fails naming it", async () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  const [request] = requests();
  const pass = await runPass({
    dir,
    goneCause,
    upload: async () => {
      chmodSync(join(dir, "requests"), 0o500);
      return R.success(undefined);
    },
  });
  expect(pass.ok ? "" : pass.error.message).toContain(request.path);
});

test("a pass that cannot delete an older request fails naming it", async () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  const [older] = requests();
  const hourAgo = new Date(Date.now() - 3_600_000);
  utimesSync(older.path, hourAgo, hourAgo);
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  const pass = await runPass({
    dir,
    goneCause,
    upload: async () => {
      rmSync(older.path);
      mkdirSync(join(older.path, "blocker"), { recursive: true });
      return R.success(undefined);
    },
  });
  expect(pass.ok ? "" : pass.error.message).toContain(older.path);
});

test("a pass that cannot delete a stale temp file fails naming it", async () => {
  mkdirSync(join(dir, "requests"));
  const stale = join(dir, "requests", "x.json.1.tmp");
  writeFileSync(stale, "partial");
  const hourAgo = new Date(Date.now() - 3_600_000);
  utimesSync(stale, hourAgo, hourAgo);
  chmodSync(join(dir, "requests"), 0o500);
  const pass = await runPass({ dir, goneCause, upload: ok });
  expect(pass.ok ? "" : pass.error.message).toContain(stale);
});

test("discard deletes only the named key's requests", async () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  R.unwrap(publish(dir, { key: "claude/b.jsonl", file: transcript }));
  expect(R.unwrap(discard({ dir, key: "claude/a.jsonl" }))).toBe(2);
  expect(requests()).toMatchObject([{ key: "claude/b.jsonl" }]);
  expect(await runPass({ dir, goneCause, upload: ok })).toEqual(
    R.success(undefined),
  );
  expect(readdirSync(join(dir, "requests"))).toEqual([]);
});

test("drain passes again for a wakeup during a pass, then releases", async () => {
  R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript }));
  let passes = 0;
  let released = false;
  const drained = await drain({
    dir,
    pass: async () => {
      if (++passes > 5) throw new Error("drain did not stop");
      if (passes === 1)
        R.unwrap(publish(dir, { key: "claude/b.jsonl", file: transcript }));
    },
    report: unexpected,
    release: () => {
      released = true;
    },
  });
  expect({ drained, passes, released }).toEqual({
    drained: R.success(false),
    passes: 2,
    released: true,
  });
});

test("drain reports a wakeup that arrives after its last check", async () => {
  const drained = await drain({
    dir,
    pass: async () => {},
    report: unexpected,
    release: () =>
      R.unwrap(publish(dir, { key: "claude/a.jsonl", file: transcript })),
  });
  expect(drained).toEqual(R.success(true));
  expect(wakeSet(dir)).toEqual(R.success(true));
});

test("drain makes one pass, reports a wakeup it cannot clear, then releases", async () => {
  mkdirSync(join(dir, "wake", "inside"), { recursive: true });
  const events: string[] = [];
  const drained = await drain({
    dir,
    pass: async () => {
      if (events.push("pass") > 5) throw new Error("drain did not stop");
    },
    report: () => events.push("report"),
    release: () => events.push("release"),
  });
  expect({ drained, events }).toEqual({
    drained: R.success(false),
    events: ["pass", "report", "release"],
  });
});

test("drain reports a wakeup it cannot check after a pass, then releases", async () => {
  const events: string[] = [];
  const drained = await drain({
    dir,
    pass: async () => {
      events.push("pass");
      chmodSync(dir, 0o000);
    },
    report: () => events.push("report"),
    release: () => events.push("release"),
  });
  expect({ drained, events }).toEqual({
    drained: R.success(false),
    events: ["pass", "report", "release"],
  });
});

test("drain fails when it cannot check for a wakeup after releasing", async () => {
  const drained = await drain({
    dir,
    pass: async () => {},
    report: unexpected,
    release: () => chmodSync(dir, 0o000),
  });
  expect(drained.ok).toBe(false);
});

test("drain releases when a pass throws", async () => {
  let released = false;
  const drained = drain({
    dir,
    pass: async () => {
      throw new Error("boom");
    },
    report: unexpected,
    release: () => {
      released = true;
    },
  });
  await expect(drained).rejects.toThrow("boom");
  expect(released).toBe(true);
});

test("wakeSet fails when the marker cannot be checked", () => {
  writeFileSync(join(dir, "wake"), "");
  chmodSync(dir, 0o000);
  expect(wakeSet(dir).ok).toBe(false);
});
