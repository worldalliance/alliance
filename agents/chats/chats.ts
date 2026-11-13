import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { envFileValue } from "../../common/src/dev-database";
import { R, type Result } from "../../common/src/result";
import awsLoginErrors from "../../scripts/aws-login-errors.json";
import { type Context, describeProblems } from "./report";
import type { S3Credentials } from "./s3";
import {
  discard,
  drain,
  isMissing,
  listRequests,
  publish,
  runPass,
  type UploadFailure,
  wake,
  wakeSet,
  writeAtomically,
} from "./spool";

enum Command {
  Upload = "upload",
  Fetch = "fetch",
  Check = "check",
  Retry = "retry",
  Discard = "discard",
  Worker = "worker",
}

enum Tool {
  Claude = "claude",
  Codex = "codex",
}

const envFile = path.resolve(import.meta.dir, "../../.env.devtools");
const keyNames = {
  accessKeyId: "AGENT_CHATS_AWS_ACCESS_KEY_ID",
  secretAccessKey: "AGENT_CHATS_AWS_SECRET_ACCESS_KEY",
} as const;
const setupHint = "agents/README.md says how to set uploads up";
const spoolDir = path.join(homedir(), ".alliance-agent-chats");
const lockFile = path.join(spoolDir, "lock");
const logFile = path.join(spoolDir, "worker.log");
const workerErrorFile = path.join(spoolDir, "worker-error");
const lockFdVar = "ALLIANCE_AGENT_CHATS_LOCK_FD";
const profile = "alliance-dev";
const loginHint = `run \`aws sso login --profile ${profile}\``;
const accessDenied = new RegExp(awsLoginErrors.accessDenied);
const loginExpired = new RegExp(awsLoginErrors.loginExpired);
const awsTimeoutMs = 8000;

// scripts/lib/worktree-lock.sh's mechanism: perl takes the kernel lock, which
// the exec'd command inherits and holds until it closes the descriptor or dies.
const lockScript = `
use Fcntl qw(:flock F_GETFD F_SETFD FD_CLOEXEC);
my ($blocking, $path, @cmd) = @ARGV;
open(my $f, ">>", $path) or die "could not open $path: $!\\n";
flock($f, LOCK_EX | LOCK_NB) or do {
  die "could not lock $path: $!\\n" unless $!{EWOULDBLOCK};
  exit 0 unless $blocking;
  print STDERR "waiting for the running upload worker to finish ('lsof $path' shows it)\\n";
  flock($f, LOCK_EX) or die "could not lock $path: $!\\n";
};
fcntl($f, F_SETFD, fcntl($f, F_GETFD, 0) & ~FD_CLOEXEC) or die "$!\\n";
$ENV{${lockFdVar}} = fileno($f);
exec { $cmd[0] } @cmd or die "could not run $cmd[0]: $!\\n";
`;

const exportedCredentials = z.object({
  AccessKeyId: z.string(),
  SecretAccessKey: z.string(),
  SessionToken: z.string(),
});

const hookInput = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string().optional(),
  transcript_path: z.string().nullish(),
  agent_transcript_path: z.string().nullish(),
});

function optedOut(): boolean {
  return process.env.ALLIANCE_AGENT_CHATS === "off";
}

function loginCredentials(): Result<S3Credentials, string> {
  const exported = R.fromThrowable(() =>
    Bun.spawnSync(
      [
        "aws",
        "configure",
        "export-credentials",
        "--profile",
        profile,
        "--format",
        "process",
      ],
      { timeout: awsTimeoutMs },
    ),
  );
  if (!exported.ok) {
    return R.failure(`could not run the aws CLI: ${exported.error.message}`);
  }
  const { exitCode, signalCode, exitedDueToTimeout, stdout, stderr } =
    exported.value;
  if (exitedDueToTimeout) {
    return R.failure(
      `aws configure export-credentials did not finish in ${awsTimeoutMs / 1000}s`,
    );
  }
  if (exitCode === null) {
    return R.failure(`aws was killed by ${signalCode}`);
  }
  if (exitCode !== 0) {
    const detail = stderr.toString().trim();
    if (detail.includes(awsLoginErrors.profileMissing)) {
      return R.failure(
        `the ${profile} AWS profile is not set up; see docs/local-secrets.md`,
      );
    }
    if (accessDenied.test(detail)) {
      return R.failure(
        `your ${profile} login was refused; ask an admin to check your ${profile} assignment`,
      );
    }
    if (loginExpired.test(detail)) {
      return R.failure(
        `your AWS login has expired or is missing; ${loginHint}`,
      );
    }
    return R.failure(`aws could not export the ${profile} login: ${detail}`);
  }
  const json = R.fromThrowable((): unknown => JSON.parse(stdout.toString()));
  // The parse error is left out, since it can quote output holding credentials.
  if (!json.ok) {
    return R.failure(
      "aws configure export-credentials printed something other than JSON",
    );
  }
  const parsed = exportedCredentials.safeParse(json.value);
  if (!parsed.success) {
    return R.failure(
      `the ${profile} profile did not return SSO session credentials; see docs/local-secrets.md`,
    );
  }
  const { AccessKeyId, SecretAccessKey, SessionToken } = parsed.data;
  return R.success({
    accessKeyId: AccessKeyId,
    secretAccessKey: SecretAccessKey,
    sessionToken: SessionToken,
  });
}

// BACKCOMPAT(ALL-1964): remove with the contract step, once everyone has run
// without ALLIANCE_SECRETS_ENV_FALLBACK.
function envFileCredentials(): Result<S3Credentials, string> {
  const accessKeyId = envFileValue(envFile, keyNames.accessKeyId);
  const secretAccessKey = envFileValue(envFile, keyNames.secretAccessKey);
  if (!accessKeyId || !secretAccessKey) {
    return R.failure(
      `${keyNames.accessKeyId} or ${keyNames.secretAccessKey} is missing from .env.devtools`,
    );
  }
  return R.success({ accessKeyId, secretAccessKey });
}

function credentials(): Result<S3Credentials, string> {
  const fallback = process.env.ALLIANCE_SECRETS_ENV_FALLBACK;
  if (fallback !== undefined && fallback !== "1")
    return R.failure(
      `ALLIANCE_SECRETS_ENV_FALLBACK is ${fallback}; set it to 1 or unset it`,
    );
  return fallback === "1" ? envFileCredentials() : loginCredentials();
}

function fail(message: string): number {
  console.error(`agents/chats/chats.ts: ${message}`);
  return 1;
}

function hookOutput(systemMessage: string | undefined): number {
  console.log(JSON.stringify(systemMessage ? { systemMessage } : {}));
  return 0;
}

function lockedCommand(params: {
  blocking: boolean;
  args: string[];
}): string[] {
  return [
    "perl",
    "-e",
    lockScript,
    params.blocking ? "1" : "0",
    lockFile,
    process.execPath,
    import.meta.path,
    ...params.args,
  ];
}

/** Starts a detached worker under the lock; it exits at once when another
 * worker holds the lock, which then sees the wakeup marker. */
function startWorker(): Result<void, Error> {
  return R.fromThrowable(() => {
    mkdirSync(spoolDir, { recursive: true, mode: 0o700 });
    const log = openSync(logFile, "a", 0o600);
    try {
      Bun.spawn(lockedCommand({ blocking: false, args: [Command.Worker] }), {
        detached: true,
        stdio: ["ignore", log, log],
      }).unref();
    } finally {
      closeSync(log);
    }
  });
}

const releaseLock = () => closeSync(Number(process.env[lockFdVar]));

function workerError(): string | undefined {
  const read = R.fromThrowable(() => readFileSync(workerErrorFile, "utf8"));
  if (read.ok) return read.value;
  return isMissing(read.error)
    ? undefined
    : `its state can't be read: ${read.error.message}`;
}

function recordWorkerError(message: string | undefined): Result<void, Error> {
  return R.fromThrowable(() => {
    if (!message) return rmSync(workerErrorFile, { force: true });
    writeAtomically({ target: workerErrorFile, contents: message });
  });
}

function problems(
  started: Result<void, Error>,
  context: Context = {},
): string | undefined {
  const listing = listRequests(spoolDir);
  if (!listing.ok) return `The spool can't be read: ${listing.error.message}`;
  return describeProblems({
    ...context,
    listing: listing.value,
    workerError: started.ok
      ? workerError()
      : `could not start: ${started.error.message}`,
    logFile,
  });
}

function warning(
  started: Result<void, Error>,
  context: Context = {},
): string | undefined {
  const found = problems(started, context);
  return (
    found &&
    `Agent transcript uploads need attention; they retry at each session start and turn, or now with \`bun agents/chats/chats.ts retry\`. ${found}.`
  );
}

async function upload(tool: Tool): Promise<number> {
  if (optedOut()) return hookOutput(undefined);
  const text = await Bun.stdin.text();
  const json = R.fromThrowable((): unknown => JSON.parse(text));
  if (!json.ok) return fail(`hook input is not JSON: ${json.error.message}`);
  const parsed = hookInput.safeParse(json.value);
  if (!parsed.success)
    return fail(`bad hook input: ${z.prettifyError(parsed.error)}`);
  const {
    session_id,
    hook_event_name,
    transcript_path,
    agent_transcript_path,
  } = parsed.data;
  const file = agent_transcript_path || transcript_path;
  if (!file || !(await Bun.file(file).exists())) return hookOutput(undefined);
  const key = agent_transcript_path
    ? `${tool}/${session_id}/${path.basename(file)}`
    : `${tool}/${session_id}.jsonl`;
  const published = publish(spoolDir, { key, file });
  if (!published.ok) {
    const once = R.fromThrowable(() =>
      Bun.spawn(
        [process.execPath, import.meta.path, Command.Worker, key, file],
        {
          detached: true,
          stdio: ["ignore", "ignore", "ignore"],
        },
      ).unref(),
    );
    return hookOutput(
      `Agent transcript ${key} could not be recorded for upload in ${spoolDir}, so it won't retry: ${published.error.message}. ${once.ok ? `It is uploading once in the background, and nothing reports whether that upload succeeds; check with \`bun agents/chats/chats.ts fetch ${key}\`.` : `Uploading it once failed too: ${once.error.message}.`}`,
    );
  }
  const { wakeError } = published.value;
  const started = startWorker();
  const notes = [
    wakeError &&
      `Agent transcript ${key} is recorded for upload, but its wakeup in ${spoolDir} couldn't be set, so it may wait for the next session start or turn: ${wakeError.message}.`,
    hook_event_name === "Stop" &&
      warning(started, { retrying: started.ok && !wakeError }),
  ].filter(Boolean);
  return hookOutput(notes.length > 0 ? notes.join(" ") : undefined);
}

async function uploader(): Promise<
  Result<
    (params: { key: string; file: string }) => Promise<Result<void, string>>,
    UploadFailure
  >
> {
  // Before the blocking credential lookup, which would otherwise delay loading
  // s3.ts's dependencies until a worktree deleted meanwhile has taken them.
  const loaded = await R.fromPromise(import("./s3"));
  if (!loaded.ok) return R.failure({ error: loaded.error.message });
  const creds = credentials();
  if (!creds.ok)
    return R.failure({ error: creds.error, credentialsFailed: true });
  const { chatsClient, putLatest } = loaded.value;
  const s3 = chatsClient(creds.value);
  if (!s3.ok) return R.failure({ error: s3.error });
  return R.success((params) => putLatest({ s3: s3.value, ...params }));
}

async function uploadPass(): Promise<Result<void, Error>> {
  const upload = await uploader();
  if (!upload.ok && !upload.error.credentialsFailed)
    return R.failure(new Error(upload.error.error));
  return runPass({
    dir: spoolDir,
    // The warning groups failures by cause, so this names no key.
    goneCause:
      "the transcript file is gone; restore it, or run `bun agents/chats/chats.ts discard <key>`",
    upload: async ({ key, file }) =>
      upload.ok
        ? R.mapError(await upload.value({ key, file }), (error) => ({ error }))
        : upload,
  });
}

/** With `printRecorded: false`, a pass failure written to `worker-error` is
 * left for the caller to report; one that couldn't be written still prints. */
async function drainSpool(params: { printRecorded: boolean }): Promise<number> {
  let status = 0;
  const report = (passed: Result<void, Error>) => {
    const recorded = recordWorkerError(
      passed.ok ? undefined : passed.error.message,
    );
    if (!recorded.ok)
      console.error(
        `could not record the worker's state: ${recorded.error.message}`,
      );
    if (passed.ok) {
      status = 0;
      return;
    }
    status =
      recorded.ok && !params.printRecorded ? 1 : fail(passed.error.message);
  };
  const drained = await drain({
    dir: spoolDir,
    pass: async () =>
      report(R.flatMap(await R.fromPromise(uploadPass()), (passed) => passed)),
    report: (error) => report(R.failure(error)),
    release: releaseLock,
  });
  // Past the release another worker may hold the lock and have recorded a
  // newer state, so this failure goes to the log and a successor, which
  // records it under the lock if it lasts.
  if (!drained.ok)
    console.error(
      `could not check for a wakeup after releasing the lock: ${drained.error.message}`,
    );
  if (!drained.ok || drained.value) {
    const started = startWorker();
    if (!started.ok)
      status = fail(`could not start a successor: ${started.error.message}`);
  }
  return status;
}

async function uploadOnce(params: {
  key: string;
  file: string;
}): Promise<number> {
  const upload = await uploader();
  if (!upload.ok) return fail(upload.error.error);
  const put = await upload.value(params);
  return put.ok ? 0 : fail(put.error);
}

async function retry(): Promise<number> {
  const status = await drainSpool({ printRecorded: false });
  const left = problems(R.success(undefined), { everyKey: true });
  if (left)
    return fail(`Agent transcript uploads still need attention: ${left}.`);
  if (status === 0) console.log("Every agent transcript upload is done.");
  return status;
}

function discardKey(key: string): number {
  const discarded = discard({ dir: spoolDir, key });
  releaseLock();
  if (!discarded.ok) return fail(discarded.error.message);
  if (discarded.value > 0)
    console.log(
      `Stopped uploading ${key}; deleted requests: ${discarded.value}.`,
    );
  const woke = wakeSet(spoolDir);
  if (!woke.ok) return fail(woke.error.message);
  const started = woke.value ? startWorker() : R.success(undefined);
  if (!started.ok)
    return fail(`could not start the worker: ${started.error.message}`);
  return discarded.value > 0
    ? 0
    : fail(
        `no upload request for ${key}; \`bun agents/chats/chats.ts retry\` names each failing transcript's key`,
      );
}

async function underLock(args: string[]): Promise<number> {
  const made = R.fromThrowable(() =>
    mkdirSync(spoolDir, { recursive: true, mode: 0o700 }),
  );
  if (!made.ok) return fail(made.error.message);
  const spawned = R.fromThrowable(() =>
    Bun.spawn(lockedCommand({ blocking: true, args }), {
      stdio: ["inherit", "inherit", "inherit"],
    }),
  );
  if (!spawned.ok)
    return fail(`could not take the upload lock: ${spawned.error.message}`);
  return spawned.value.exited;
}

async function download(key: string): Promise<number> {
  const creds = credentials();
  if (!creds.ok) return fail(`${creds.error}; ${setupHint}`);
  const { chatsClient, getObject } = await import("./s3");
  const s3 = chatsClient(creds.value);
  if (!s3.ok) return fail(`fetch of ${key} failed: ${s3.error}`);
  const got = await getObject({ s3: s3.value, key });
  if (!got.ok) return fail(`fetch of ${key} failed: ${got.error}`);
  await Bun.write(Bun.stdout, got.value);
  return 0;
}

function check(): number {
  if (optedOut()) return 0;
  const creds = credentials();
  const listing = listRequests(spoolDir);
  const needsWorker =
    (listing.ok && listing.value.requests.length > 0) ||
    workerError() !== undefined;
  // A worker already holding the lock makes another pass only for the marker.
  const woke = needsWorker ? wake(spoolDir) : R.success(undefined);
  const started = needsWorker ? startWorker() : R.success(undefined);
  const message = [
    creds.ok
      ? undefined
      : `Agent transcript uploads are not working on this machine, so this session's transcript is not being stored yet: ${creds.error}. ${setupHint}.`,
    !woke.ok &&
      `The agent transcript upload wakeup in ${spoolDir} couldn't be set, so a running worker may not make another pass: ${woke.error.message}.`,
    warning(
      started,
      creds.ok ? { credentialsWork: started.ok } : { statedCause: creds.error },
    ),
  ]
    .filter(Boolean)
    .join(" ");
  if (!message) return 0;
  console.log(
    JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: message,
      },
    }),
  );
  return 0;
}

const usage =
  "usage: chats.ts upload claude|codex | fetch <key> | check | retry | discard <key>";

async function main(): Promise<number> {
  const [rawCommand, arg, extra] = process.argv.slice(2);
  const command = z.enum(Command).safeParse(rawCommand);
  if (!command.success) return fail(usage);
  const chosen = command.data;
  const locked = process.env[lockFdVar] !== undefined;
  switch (chosen) {
    case Command.Upload: {
      const tool = z.enum(Tool).safeParse(arg);
      if (!tool.success) return fail("usage: chats.ts upload claude|codex");
      return upload(tool.data);
    }
    case Command.Fetch:
      if (!arg) return fail("usage: chats.ts fetch <key>");
      return download(arg);
    case Command.Check:
      return check();
    case Command.Retry:
      return locked ? retry() : underLock([Command.Retry]);
    case Command.Discard:
      if (!arg) return fail("usage: chats.ts discard <key>");
      return locked ? discardKey(arg) : underLock([Command.Discard, arg]);
    case Command.Worker:
      if (arg && extra) return uploadOnce({ key: arg, file: extra });
      return locked
        ? drainSpool({ printRecorded: true })
        : fail("the worker runs only under its lock");
    default:
      throw new Error(`unknown command: ${chosen satisfies never}`);
  }
}

process.exit(await main());
