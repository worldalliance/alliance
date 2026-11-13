import { expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { R } from "../../common/src/result";
import {
  awsScript,
  dir,
  expired,
  fakeAws,
  hook,
  loggedIn,
  replaceS3,
  requests,
  run,
  s3,
  spool,
  transcript,
  until,
  useChatsFixture,
} from "./chats-fixture";
import { publish } from "./spool";

useChatsFixture();

test("a hook records the transcript and a background worker uploads it", async () => {
  fakeAws(loggedIn);
  expect(await hook("Stop")).toMatchObject({ exitCode: 0, stdout: "{}\n" });
  await until(() => s3.body("claude/abc.jsonl") !== undefined);
  await until(() => requests().length === 0);
  expect(s3.signers).toEqual([
    {
      authorization: expect.stringContaining("Credential=ASIAEXAMPLE/"),
      token: "token",
    },
  ]);
});

test("a request published while the worker uploads gets a pass without a retry", async () => {
  fakeAws(loggedIn);
  let published = false;
  replaceS3({
    beforePut: () => {
      if (published) return;
      published = true;
      R.unwrap(publish(spool(), { key: "claude/def.jsonl", file: transcript }));
    },
  });
  await hook("SubagentStop");
  await until(() => s3.body("claude/def.jsonl") !== undefined);
  expect(s3.body("claude/abc.jsonl")).toBe("{}\n");
  await until(() => requests().length === 0);
});

test("an expired login keeps the transcript, warns at Stop, and goes up after login", async () => {
  await hook("SubagentStop");
  const retried = await run(["retry"]);
  expect(retried.exitCode).toBe(1);
  expect(retried.stderr).toContain("still need attention");
  expect(retried.stderr).toContain("aws sso login --profile alliance-dev");
  expect(retried.stderr).not.toContain("chats.ts retry");
  expect(requests()).toMatchObject([
    { key: "claude/abc.jsonl", file: transcript },
  ]);
  for (const event of ["SubagentStop", "PreCompact", "SessionEnd"])
    expect((await hook(event)).stdout).toBe("{}\n");
  const stop = await hook("Stop");
  const { systemMessage } = JSON.parse(stop.stdout);
  expect(systemMessage).toContain(
    "The last upload attempt failed for claude/abc.jsonl: your AWS login has expired",
  );
  expect(systemMessage).toContain("retrying now");
  expect(systemMessage).toContain("bun agents/chats/chats.ts retry");
  fakeAws(loggedIn);
  expect(await run(["retry"])).toMatchObject({ exitCode: 0 });
  expect(s3.body("claude/abc.jsonl")).toBe("{}\n");
  expect(requests()).toEqual([]);
});

test("a deleted transcript warns until it is discarded", async () => {
  await hook("SubagentStop");
  rmSync(transcript);
  fakeAws(loggedIn);
  const retried = await run(["retry"]);
  expect(retried.exitCode).toBe(1);
  expect(retried.stderr).toContain("is gone; restore it");
  expect(await run(["discard", "claude/abc.jsonl"])).toMatchObject({
    exitCode: 0,
    stdout: "Stopped uploading claude/abc.jsonl; deleted requests: 1.\n",
  });
  expect(await run(["retry"])).toMatchObject({ exitCode: 0 });
});

test("retry names every deleted transcript's key", async () => {
  fakeAws(loggedIn);
  const keys = ["a", "b", "c", "d"].map((name) => `claude/${name}.jsonl`);
  for (const key of keys)
    R.unwrap(publish(spool(), { key, file: join(dir, "deleted.jsonl") }));
  const retried = await run(["retry"]);
  expect(retried.exitCode).toBe(1);
  for (const key of keys) expect(retried.stderr).toContain(key);
});

test("discard starts a worker for a request published while it held the lock", async () => {
  fakeAws(loggedIn);
  R.unwrap(publish(spool(), { key: "claude/abc.jsonl", file: transcript }));
  R.unwrap(publish(spool(), { key: "claude/gone.jsonl", file: transcript }));
  expect(await run(["discard", "claude/gone.jsonl"])).toMatchObject({
    exitCode: 0,
  });
  await until(() => s3.body("claude/abc.jsonl") !== undefined);
});

test("discard fails for a key with no requests", async () => {
  fakeAws(loggedIn);
  expect(await run(["discard", "gone.jsonl"])).toMatchObject({
    exitCode: 1,
    stderr: expect.stringContaining(
      "no upload request for gone.jsonl; `bun agents/chats/chats.ts retry` names",
    ),
  });
});

async function holdLock() {
  mkdirSync(spool(), { recursive: true });
  const holder = Bun.spawn(
    [
      "perl",
      "-MFcntl=:flock",
      "-e",
      'open(my $f, ">>", $ARGV[0]) or die; flock($f, LOCK_EX) or die; print "held\\n"; STDOUT->flush; sleep 30',
      join(spool(), "lock"),
    ],
    { stdout: "pipe" },
  );
  await holder.stdout.getReader().read();
  return holder;
}

test("a worker that finds the lock held leaves the request to the holder", async () => {
  fakeAws(loggedIn);
  const holder = await holdLock();
  await hook("SubagentStop");
  await Bun.sleep(1000);
  expect(s3.puts).toEqual([]);
  expect(requests()).toHaveLength(1);
  holder.kill();
  await holder.exited;
  await Bun.sleep(1000);
  expect(s3.puts).toEqual([]);
  expect(await run(["retry"])).toMatchObject({ exitCode: 0 });
  expect(s3.puts).toEqual(["claude/abc.jsonl"]);
});

test("an unreadable request joins the Stop warning without failing the hook", async () => {
  mkdirSync(join(spool(), "requests"), { recursive: true });
  writeFileSync(join(spool(), "requests", "junk.json"), "not json");
  const stop = await hook("Stop");
  expect(stop.exitCode).toBe(0);
  expect(JSON.parse(stop.stdout).systemMessage).toContain(
    "Unreadable, so delete them",
  );
});

test("a wakeup it cannot set still records the request and says so", async () => {
  mkdirSync(join(spool(), "wake"), { recursive: true });
  const stop = await hook("SubagentStop");
  expect(stop.exitCode).toBe(0);
  expect(JSON.parse(stop.stdout).systemMessage).toContain(
    "claude/abc.jsonl is recorded for upload, but its wakeup",
  );
  expect(requests()).toMatchObject([{ key: "claude/abc.jsonl" }]);
});

test("Stop doesn't say retrying now when its wakeup couldn't be set", async () => {
  await hook("SubagentStop");
  rmSync(transcript);
  fakeAws(loggedIn);
  await run(["retry"]);
  writeFileSync(transcript, "{}\n");
  rmSync(join(spool(), "wake"), { force: true });
  mkdirSync(join(spool(), "wake"));
  const { systemMessage } = JSON.parse((await hook("Stop")).stdout);
  expect(systemMessage).toContain("Upload failed for claude/abc.jsonl");
  expect(systemMessage).not.toContain("retrying now");
});

test("a spool it cannot write still uploads once and says retry is off", async () => {
  fakeAws(loggedIn);
  writeFileSync(spool(), "");
  const stop = await hook("Stop");
  expect(stop.exitCode).toBe(0);
  const { systemMessage } = JSON.parse(stop.stdout);
  expect(systemMessage).toContain("could not be recorded for upload");
  expect(systemMessage).toContain("chats.ts fetch claude/abc.jsonl");
  await until(() => s3.body("claude/abc.jsonl") !== undefined);
});

test("check warns about failed uploads and starts the worker", async () => {
  await hook("SubagentStop");
  rmSync(transcript);
  fakeAws(loggedIn);
  await run(["retry"]);
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  expect(systemMessage).toContain("Upload failed for claude/abc.jsonl");
  writeFileSync(transcript, "{}\n");
  await until(() => s3.body("claude/abc.jsonl") !== undefined);
});

test("once logged in, check leaves out uploads that failed on the login", async () => {
  await hook("SubagentStop");
  await run(["retry"]);
  fakeAws(loggedIn);
  expect(await run(["check"])).toMatchObject({ exitCode: 0, stdout: "" });
  await until(() => s3.body("claude/abc.jsonl") !== undefined);
});

test("check sets the wakeup, so a worker holding the lock makes another pass", async () => {
  await hook("SubagentStop");
  await run(["retry"]);
  fakeAws(loggedIn);
  const holder = await holdLock();
  expect(await run(["check"])).toMatchObject({ exitCode: 0, stdout: "" });
  expect(existsSync(join(spool(), "wake"))).toBe(true);
  holder.kill();
  await holder.exited;
});

test("a pass that cannot update its requests warns until a clean pass", async () => {
  await hook("SubagentStop");
  chmodSync(join(spool(), "requests"), 0o500);
  const retried = await run(["retry"]);
  expect(retried.exitCode).toBe(1);
  expect(retried.stderr.split("could not update").length).toBe(2);
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  chmodSync(join(spool(), "requests"), 0o700);
  expect(systemMessage).toContain("The uploader failed: could not update");
  fakeAws(loggedIn);
  expect(await run(["retry"])).toMatchObject({ exitCode: 0 });
  expect(await run(["check"])).toMatchObject({ stdout: "" });
});

test("retry succeeds when a later pass clears an earlier pass's failure", async () => {
  R.unwrap(publish(spool(), { key: "claude/abc.jsonl", file: transcript }));
  const requestsDir = join(spool(), "requests");
  const calls = join(dir, "calls");
  writeFileSync(join(dir, "stdout"), loggedIn.stdout);
  awsScript(`if [ -e "${calls}" ]; then chmod 700 "${requestsDir}"; cat "${join(dir, "stdout")}"; exit 0; fi
touch "${calls}" "${join(spool(), "wake")}"; chmod 500 "${requestsDir}"
echo "${expired.stderr}" >&2; exit ${expired.exitCode}`);
  const retried = await run(["retry"]);
  expect(retried).toMatchObject({
    exitCode: 0,
    stdout: "Every agent transcript upload is done.\n",
  });
  expect(s3.body("claude/abc.jsonl")).toBeDefined();
});

test("check retries an uploader failure with no requests left", async () => {
  mkdirSync(spool(), { recursive: true });
  writeFileSync(join(spool(), "worker-error"), "could not update x");
  fakeAws(loggedIn);
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  expect(systemMessage).toContain("The uploader failed: could not update x");
  await until(() => !existsSync(join(spool(), "worker-error")));
});

test("an unreadable worker state is a warning, not a clean bill", async () => {
  mkdirSync(spool(), { recursive: true });
  writeFileSync(join(spool(), "worker-error"), "boom");
  chmodSync(join(spool(), "worker-error"), 0o000);
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  expect(systemMessage).toContain(
    "The uploader failed: its state can't be read",
  );
});

test("retry says it is waiting while a worker holds the lock", async () => {
  mkdirSync(spool(), { recursive: true });
  const holder = Bun.spawn(
    [
      "perl",
      "-MFcntl=:flock",
      "-e",
      'open(my $f, ">>", $ARGV[0]) or die; flock($f, LOCK_EX) or die; print "held\\n"; STDOUT->flush; sleep 1',
      join(spool(), "lock"),
    ],
    { stdout: "pipe" },
  );
  const reader = holder.stdout.getReader();
  await reader.read();
  const retried = await run(["retry"]);
  await holder.exited;
  expect(retried).toMatchObject({ exitCode: 0 });
  expect(retried.stderr).toContain("waiting for the running upload worker");
}, 15_000);

test("a wakeup marker the worker cannot clear is recorded as the uploader's failure, and check names it apart", async () => {
  mkdirSync(join(spool(), "wake", "inside"), { recursive: true });
  expect((await run(["retry"])).exitCode).toBe(1);
  const { systemMessage } = JSON.parse((await run(["check"])).stdout);
  rmSync(join(spool(), "wake"), { recursive: true });
  expect(systemMessage).toContain("wakeup in ");
  expect(systemMessage).toContain("couldn't be set");
  expect(systemMessage).toMatch(/The uploader failed: .*EISDIR/);
  expect(systemMessage).not.toContain("could not start");
});

test("a pass that throws is recorded as the uploader's failure", async () => {
  fakeAws(loggedIn);
  await hook("SubagentStop");
  const unparsable = { ALLIANCE_AGENT_CHATS_S3_ENDPOINT: "not a url" };
  expect((await run(["retry"], "", unparsable)).exitCode).toBe(1);
  const { systemMessage } = JSON.parse(
    (await run(["check"], "", unparsable)).stdout,
  );
  expect(systemMessage).toContain("The uploader failed: Invalid URL");
});

test("retry names a missing perl", async () => {
  const empty = join(dir, "empty");
  mkdirSync(empty);
  const { exitCode, stderr } = await run(["retry"], "", { PATH: empty });
  expect(exitCode).toBe(1);
  expect(stderr).toContain("could not take the upload lock: ");
});

test("a worker that can't start is named at Stop and check, not called retrying", async () => {
  const bin = join(dir, "bin");
  mkdirSync(bin);
  symlinkSync("/bin/bash", join(bin, "bash"));
  const withoutPerl = { PATH: `${dir}:${bin}` };
  const stopInput = JSON.stringify({
    session_id: "abc",
    hook_event_name: "Stop",
    transcript_path: transcript,
  });
  for (const args of [["upload", "claude"], ["check"]]) {
    const { stdout } = await run(args, stopInput, withoutPerl);
    const { systemMessage } = JSON.parse(stdout);
    expect(systemMessage).toContain("The uploader failed: could not start: ");
    expect(systemMessage).not.toContain("retrying now");
  }
});

test("fetch prints a stored transcript and names S3's error for a missing one", async () => {
  fakeAws(loggedIn);
  s3.store("claude/abc.jsonl", "hello\n");
  expect(await run(["fetch", "claude/abc.jsonl"])).toEqual({
    exitCode: 0,
    stdout: "hello\n",
    stderr: "",
  });
  expect(await run(["fetch", "claude/none.jsonl"])).toMatchObject({
    exitCode: 1,
    stdout: "",
    stderr: expect.stringContaining(
      "fetch of claude/none.jsonl failed: NoSuchKey",
    ),
  });
});
