import { S3Client } from "bun";
import path from "node:path";
import { z } from "zod";
import { envFileValue } from "../../common/src/dev-database";
import { R, type Result } from "../../common/src/result";

enum Command {
  Upload = "upload",
  Fetch = "fetch",
  Check = "check",
}

enum Tool {
  Claude = "claude",
  Codex = "codex",
}

const bucket = "alliance-agent-chats";
const envFile = path.resolve(import.meta.dir, "../../.env.devtools");
const keyNames = {
  accessKeyId: "AGENT_CHATS_AWS_ACCESS_KEY_ID",
  secretAccessKey: "AGENT_CHATS_AWS_SECRET_ACCESS_KEY",
} as const;
const setupHint = "agents/README.md says how to set uploads up";

const s3Error = z.object({ code: z.string() });

const hookInput = z.object({
  session_id: z.string().min(1),
  transcript_path: z.string().nullish(),
  agent_transcript_path: z.string().nullish(),
});

function optedOut(): boolean {
  return process.env.ALLIANCE_AGENT_CHATS === "off";
}

function credentials(): Result<
  { accessKeyId: string; secretAccessKey: string },
  string
> {
  const accessKeyId = envFileValue(envFile, keyNames.accessKeyId);
  const secretAccessKey = envFileValue(envFile, keyNames.secretAccessKey);
  if (!accessKeyId || !secretAccessKey) {
    return R.failure(
      `${keyNames.accessKeyId} or ${keyNames.secretAccessKey} is missing from .env.devtools; ${setupHint}`,
    );
  }
  return R.success({ accessKeyId, secretAccessKey });
}

function client(creds: {
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    ...creds,
    region: "us-west-2",
    endpoint: "https://s3.us-west-2.amazonaws.com",
    bucket,
  });
}

function fail(message: string): number {
  console.error(`agents/chats/chats.ts: ${message}`);
  return 1;
}

function s3Failure(error: unknown): string {
  const code = s3Error.safeParse(error);
  const message = R.toError(error).message;
  return code.success ? `${code.data.code}: ${message}` : message;
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
  if (!creds.ok) return fail(`upload of ${key} failed: ${creds.error}`);
  try {
    await client(creds.value).write(key, Bun.file(file));
  } catch (error) {
    return fail(`upload of ${key} failed: ${s3Failure(error)}`);
  }
  return hookDone();
}

async function download(key: string): Promise<number> {
  const creds = credentials();
  if (!creds.ok) return fail(creds.error);
  try {
    await Bun.write(Bun.stdout, client(creds.value).file(key));
  } catch (error) {
    return fail(`fetch of ${key} failed: ${s3Failure(error)}`);
  }
  return 0;
}

function check(): number {
  if (optedOut() || credentials().ok) return 0;
  const message = `Agent transcript uploads are not set up on this machine, so this session's transcript is not being stored; ${setupHint}.`;
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

const tokenVars = ["AWS_SESSION_TOKEN", "S3_SESSION_TOKEN"];

// Bun.S3Client sends an environment session token alongside explicit keys, which
// AWS rejects for static keys, and reads it only at launch.
async function withoutAmbientToken(): Promise<number> {
  const env = {
    ...process.env,
    ...Object.fromEntries(tokenVars.map((name) => [name, ""])),
  };
  const child = Bun.spawn([process.execPath, ...process.argv.slice(1)], {
    env,
    stdio: ["inherit", "inherit", "inherit"],
  });
  return child.exited;
}

process.exit(
  await (tokenVars.some((name) => process.env[name])
    ? withoutAmbientToken()
    : main()),
);
