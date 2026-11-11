import path from "node:path";
import { z } from "zod";
import { envFileValue } from "../../common/src/dev-database";
import { R, type Result } from "../../common/src/result";
import awsLoginErrors from "../../scripts/aws-login-errors.json";
import type { S3Credentials } from "./s3";

enum Command {
  Upload = "upload",
  Fetch = "fetch",
  Check = "check",
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
const profile = "alliance-dev";
const loginHint = `run \`aws sso login --profile ${profile}\``;
const accessDenied = new RegExp(awsLoginErrors.accessDenied);
const loginExpired = new RegExp(awsLoginErrors.loginExpired);
const awsTimeoutMs = 8000;

const exportedCredentials = z.object({
  AccessKeyId: z.string(),
  SecretAccessKey: z.string(),
  SessionToken: z.string(),
});

const hookInput = z.object({
  session_id: z.string().min(1),
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

function hookDone(): number {
  console.log("{}");
  return 0;
}

async function upload(tool: Tool): Promise<number> {
  if (optedOut()) return hookDone();
  const text = await Bun.stdin.text();
  const json = R.fromThrowable((): unknown => JSON.parse(text));
  if (!json.ok) return fail(`hook input is not JSON: ${json.error.message}`);
  const parsed = hookInput.safeParse(json.value);
  if (!parsed.success)
    return fail(`bad hook input: ${z.prettifyError(parsed.error)}`);
  const { session_id, transcript_path, agent_transcript_path } = parsed.data;
  const file = agent_transcript_path || transcript_path;
  if (!file || !(await Bun.file(file).exists())) return hookDone();
  const key = agent_transcript_path
    ? `${tool}/${session_id}/${path.basename(file)}`
    : `${tool}/${session_id}.jsonl`;
  const creds = credentials();
  if (!creds.ok)
    return fail(`upload of ${key} failed: ${creds.error}; ${setupHint}`);
  const { chatsClient, putLatest } = await import("./s3");
  const s3 = chatsClient(creds.value);
  if (!s3.ok) return fail(`upload of ${key} failed: ${s3.error}`);
  const put = await putLatest({ s3: s3.value, key, file });
  return put.ok ? hookDone() : fail(`upload of ${key} failed: ${put.error}`);
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
  if (creds.ok) return 0;
  const message = `Agent transcript uploads are not working on this machine, so this session's transcript is not being stored yet: ${creds.error}. ${setupHint}.`;
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

async function main(): Promise<number> {
  const [rawCommand, arg] = process.argv.slice(2);
  const command = z.enum(Command).safeParse(rawCommand);
  if (!command.success)
    return fail("usage: chats.ts upload claude|codex | fetch <key> | check");
  const chosen = command.data;
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
    default:
      throw new Error(`unknown command: ${chosen satisfies never}`);
  }
}

process.exit(await main());
