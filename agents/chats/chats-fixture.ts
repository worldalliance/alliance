import { afterEach, beforeEach, setDefaultTimeout } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { R } from "../../common/src/result";
import { fakeS3 } from "./fake-s3";
import { listRequests } from "./spool";

const SCRIPT = join(import.meta.dir, "chats.ts");

export let dir: string;
export let transcript: string;
export let s3: ReturnType<typeof fakeS3>;

export function fakeAws(params: {
  stderr?: string;
  stdout?: string;
  exitCode: number;
}) {
  writeFileSync(join(dir, "stdout"), params.stdout ?? "");
  writeFileSync(
    join(dir, "aws"),
    `#!/usr/bin/env bash
cat "${join(dir, "stdout")}"
echo "${params.stderr ?? ""}" >&2
exit ${params.exitCode}
`,
  );
  chmodSync(join(dir, "aws"), 0o755);
}

export const expired = {
  stderr: "Token has expired and refresh failed",
  exitCode: 254,
};

export const exported = {
  Version: 1,
  AccessKeyId: "ASIAEXAMPLE",
  SecretAccessKey: "secret",
  SessionToken: "token",
  Expiration: "2030-01-01T00:00:00Z",
};
export const loggedIn = { stdout: JSON.stringify(exported), exitCode: 0 };

export function useChatsFixture() {
  // Tests wait on detached workers, which start slowly under load; this
  // outlasts two of until's waits.
  setDefaultTimeout(30_000);
  beforeEach(setUp);
  afterEach(cleanUp);
}

export function replaceS3(params: Parameters<typeof fakeS3>[0]) {
  s3.stop();
  s3 = fakeS3(params);
}

function setUp() {
  dir = mkdtempSync(join(tmpdir(), "chats-"));
  transcript = join(dir, "session.jsonl");
  writeFileSync(transcript, "{}\n");
  fakeAws(expired);
  s3 = fakeS3();
}

async function cleanUp() {
  // A worker a test started can still be writing in dir, also after it
  // releases the lock, and its successor can take seconds to start under load.
  s3.stop();
  const deadline = Date.now() + 10_000;
  for (;;) {
    const removed = Bun.spawnSync([
      "perl",
      "-MFcntl=:flock",
      "-e",
      'open(my $f, ">>", $ARGV[0]) and flock($f, LOCK_EX); exit system("rm", "-rf", $ARGV[1]) >> 8',
      join(dir, ".alliance-agent-chats", "lock"),
      dir,
    ]);
    if (removed.exitCode === 0) return;
    if (Date.now() > deadline) throw new Error(removed.stderr.toString());
    await Bun.sleep(200);
  }
}

export async function run(
  args: string[],
  stdin = "",
  env: Record<string, string> = {},
) {
  const child = Bun.spawn([process.execPath, SCRIPT, ...args], {
    stdin: Buffer.from(stdin),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      HOME: dir,
      ALLIANCE_AGENT_CHATS_S3_ENDPOINT: s3.endpoint,
      ...env,
    },
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

export const hook = (event: string, sessionId = "abc") =>
  run(
    ["upload", "claude"],
    JSON.stringify({
      session_id: sessionId,
      hook_event_name: event,
      transcript_path: transcript,
    }),
  );

export const spool = () => join(dir, ".alliance-agent-chats");
export const requests = () => R.unwrap(listRequests(spool())).requests;

export async function until(condition: () => boolean) {
  for (let waited = 0; !condition(); waited += 50) {
    if (waited > 10_000) throw new Error("timed out");
    await Bun.sleep(50);
  }
}

export function awsScript(body: string) {
  writeFileSync(join(dir, "aws"), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(join(dir, "aws"), 0o755);
}
