import { afterEach, beforeEach } from "bun:test";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ONE_AND_TWO = [
  { Name: "/alliance/dev/server/ONE", Value: "1" },
  { Name: "/alliance/dev/server/TWO", Value: "2" },
];

/** Call once per test file: Bun shares imported modules across files, so
 * hooks registered at this module's top level would bind to the first file
 * alone. */
export function withSecretsFixture() {
  let dir = "";
  let repo = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "with-secrets-"));
    repo = join(dir, "repo");
    mkdirSync(join(repo, "scripts"), { recursive: true });
    cpSync(
      join(import.meta.dir, "..", "with-secrets.sh"),
      join(repo, "scripts/with-secrets.sh"),
    );
    cpSync(
      join(import.meta.dir, "..", "aws-login-errors.json"),
      join(repo, "scripts/aws-login-errors.json"),
    );
    writeFileSync(
      join(repo, "scripts/dev-secrets.json"),
      JSON.stringify({
        server: {
          envFile: "server.env",
          loadsEnvFile: false,
          secrets: ["ONE", "TWO"],
        },
      }),
    );
    writeFileSync(
      join(dir, "aws"),
      `#!/usr/bin/env bash
  echo "aws $* profile=$AWS_PROFILE" >> "$LOG"
  if [ -n "\${AWS_STDERR:-}" ]; then echo "$AWS_STDERR" >&2; exit 254; fi
  cat "$RESPONSE"
  `,
    );
    writeFileSync(
      join(dir, "app"),
      `#!/usr/bin/env bash
  printf 'app %s ONE=%s TWO=%s PROFILE=%s MARKER=%s\\n' "$*" "\${ONE-unset}" "\${TWO-unset}" "\${AWS_PROFILE-unset}" "\${ALLIANCE_SECRETS_LOADED-unset}" >> "$LOG"
  `,
    );
    chmodSync(join(dir, "aws"), 0o755);
    chmodSync(join(dir, "app"), 0o755);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  function run(params: {
    env?: Record<string, string>;
    parameters?: { Name: string; Value: string }[];
    args?: string[];
  }) {
    const {
      env = {},
      parameters = ONE_AND_TWO,
      args = ["server", "app", "x"],
    } = params;
    const log = join(dir, "log");
    const response = join(dir, "response.json");
    writeFileSync(response, JSON.stringify({ Parameters: parameters }));
    const result = Bun.spawnSync(
      ["bash", join(repo, "scripts/with-secrets.sh"), ...args],
      {
        env: {
          PATH: `${dir}:${process.env.PATH}`,
          LOG: log,
          RESPONSE: response,
          ...env,
        },
      },
    );
    return {
      exitCode: result.exitCode,
      stderr: result.stderr.toString(),
      log: existsSync(log) ? readFileSync(log, "utf8") : "",
    };
  }

  const loadingEnvFile = () =>
    writeFileSync(
      join(repo, "scripts/dev-secrets.json"),
      JSON.stringify({
        server: {
          envFile: "server.env",
          loadsEnvFile: true,
          secrets: ["ONE", "TWO"],
        },
      }),
    );

  return {
    get dir() {
      return dir;
    },
    get repo() {
      return repo;
    },
    run,
    loadingEnvFile,
  };
}
