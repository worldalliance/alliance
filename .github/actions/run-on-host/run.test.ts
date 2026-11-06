import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Stands in for the AWS CLI: logs each call, answers send-command with
// cmd-1, reports InvocationDoesNotExist once, $FAKE_RUNNING_STATUS (InProgress by
// default) $FAKE_IN_PROGRESS_POLLS times and then $FAKE_STATUS with $FAKE_STATUS_DETAILS (or
// $FAKE_INVOCATION_ERROR every time), keeps the uploaded script.sh and hands it
// to the host's download, and copies $FAKE_STDOUT down as the command's S3 output.
const FAKE_AWS = `#!/usr/bin/env bash
echo "$*" >> "$FAKE_DIR/calls"
case "$1 $2" in
  "ssm send-command")
    while [ $# -gt 0 ]; do
      [ "$1" = --parameters ] && printf '%s' "$2" > "$FAKE_DIR/parameters"
      shift
    done
    echo cmd-1 ;;
  "ssm get-command-invocation")
    if [ -n "\${FAKE_INVOCATION_ERROR:-}" ]; then echo "$FAKE_INVOCATION_ERROR" >&2; exit 254; fi
    if [ ! -e "$FAKE_DIR/polled" ]; then
      touch "$FAKE_DIR/polled"
      echo "An error occurred (InvocationDoesNotExist)" >&2; exit 254
    fi
    echo >> "$FAKE_DIR/polls"
    if [ "$(wc -l < "$FAKE_DIR/polls")" -le "\${FAKE_IN_PROGRESS_POLLS:-0}" ]; then
      printf '{"Status":"%s"}' "\${FAKE_RUNNING_STATUS:-InProgress}"; exit 0
    fi
    printf '{"Status":"%s","StatusDetails":"%s","ResponseCode":%s,"StandardOutputContent":"truncated"}' "$FAKE_STATUS" "\${FAKE_STATUS_DETAILS:-$FAKE_STATUS}" "\${FAKE_CODE:-0}" ;;
  "s3 cp")
    case "$5" in *script.sh) cp "$4" "$FAKE_DIR/script.sh" ;; esac
    case "$3 $6" in "--region "*script.sh) cp "$FAKE_DIR/script.sh" "$7" ;; esac
    if [ "$3" = --only-show-errors ] && [ "$4" = --recursive ] && [ -n "\${FAKE_STDOUT:-}" ]; then
      mkdir -p "$6/i-staging/awsrunShellScript/0.awsrunShellScript"
      printf '%s\\n' "$FAKE_STDOUT" > "$6/i-staging/awsrunShellScript/0.awsrunShellScript/stdout"
    fi ;;
esac
`;

// Stand-ins for the host: sudo hands the command to a shell's -c, as -i does,
// timeout runs it without a limit, and flock appends $FAKE_ARRIVAL to the
// queue, as a command arriving while this one waits would, then takes the lock
// at once, or times out when $FAKE_LOCK_HELD is set.
const FAKE_HOST: Record<string, string> = {
  sudo: `#!/usr/bin/env bash
while [ "\${1#-}" != "$1" ]; do shift 2; done
exec bash -c "$*"
`,
  timeout: `#!/usr/bin/env bash
shift 5
exec "$@"
`,
  flock: `#!/usr/bin/env bash
[ -z "\${FAKE_ARRIVAL:-}" ] || echo "$FAKE_ARRIVAL" >> "$FAKE_DIR/run-on-host-deploy-react-app.queue"
[ -z "\${FAKE_LOCK_HELD:-}" ]
`,
};

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "run-on-host-"));
  writeFileSync(join(dir, "aws"), FAKE_AWS);
  chmodSync(join(dir, "aws"), 0o755);
  writeFileSync(join(dir, "react-build.zip"), "zip");
});

afterEach(() => rmSync(dir, { recursive: true }));

function run(env: Record<string, string>) {
  const result = Bun.spawnSync(["bash", `${import.meta.dir}/run.sh`], {
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      FAKE_DIR: dir,
      POLL_SECONDS: "0",
      ENVIRONMENT: "staging",
      FILES: `${join(dir, "react-build.zip")}\n`,
      SCRIPT: "echo deployed",
      TIMEOUT_MINUTES: "1",
      ROLE_DURATION_SECONDS: "10800",
      DEPLOY_ARTIFACTS_BUCKET: "artifacts",
      STAGING_INSTANCE_ID: "i-staging",
      PRODUCTION_INSTANCE_ID: "i-production",
      GITHUB_RUN_ID: "7",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_JOB: "deploy-react-app",
      ...env,
    },
  });
  const calls = readFileSync(join(dir, "calls"), "utf8");
  return {
    code: result.exitCode,
    output: result.stdout.toString(),
    errors: result.stderr.toString(),
    calls,
  };
}

function runOnHost(params: {
  arrival: string;
  queue?: string;
  lockHeld?: boolean;
  closedPipe?: boolean;
}) {
  for (const [name, script] of Object.entries(FAKE_HOST)) {
    writeFileSync(join(dir, name), script);
    chmodSync(join(dir, name), 0o755);
  }
  if (params.queue) {
    writeFileSync(
      join(dir, "run-on-host-deploy-react-app.queue"),
      params.queue,
    );
  }
  const command: string = JSON.parse(
    readFileSync(join(dir, "parameters"), "utf8"),
  ).commands[0].replaceAll("/run/lock", dir);
  writeFileSync(join(dir, "calls"), "");
  const argv = params.closedPipe
    ? ["bash", "-c", 'bash -c "$0" | true', command]
    : ["bash", "-c", command];
  const result = Bun.spawnSync(argv, {
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      FAKE_DIR: dir,
      FAKE_ARRIVAL: params.arrival,
      FAKE_LOCK_HELD: params.lockHeld ? "1" : "",
    },
  });
  const calls = readFileSync(join(dir, "calls"), "utf8");
  return { code: result.exitCode, output: result.stdout.toString(), calls };
}

describe("run-on-host", () => {
  test("uploads the script and files, runs them on the environment's host, and prints the output", () => {
    const { code, output, calls } = run({
      FAKE_STATUS: "Success",
      FAKE_STDOUT: "deployed",
    });
    expect(code).toBe(0);
    expect(output).toContain("deployed");
    const prefix = calls.match(
      /s3:\/\/artifacts\/(staging\/7-1\/deploy-react-app\/[^/]+)\/script\.sh/,
    )?.[1];
    expect(prefix).toBeDefined();
    expect(calls).toContain(`s3://artifacts/${prefix}/files/react-build.zip`);
    expect(calls).toContain(`--output-s3-key-prefix ${prefix}/output`);
    expect(calls).toContain("--instance-ids i-staging");
    const parameters = JSON.parse(
      readFileSync(join(dir, "parameters"), "utf8"),
    );
    expect(parameters.executionTimeout).toEqual(["2100"]);
    expect(parameters.commands[0]).toContain("flock -w 1080 9");
    expect(parameters.commands[0]).toContain(
      "timeout -s TERM -k 900 60 sudo -iu ec2-user exec bash",
    );
  });

  test("targets the production host and prefix for production", () => {
    const { calls } = run({
      ENVIRONMENT: "production",
      FAKE_STATUS: "Success",
    });
    expect(calls).toContain("--instance-ids i-production");
    expect(calls).toMatch(
      /s3:\/\/artifacts\/production\/7-1\/deploy-react-app\/[^/]+\/script\.sh/,
    );
  });

  test("keeps the script's shell alive at SIGTERM until its command recovers", () => {
    run({ FAKE_STATUS: "Success" });
    expect(readFileSync(join(dir, "script.sh"), "utf8")).toBe(
      "trap 'exit 143' TERM\necho deployed\n",
    );
  });

  test("gives each call its own prefix", () => {
    run({ FAKE_STATUS: "Success" });
    run({ FAKE_STATUS: "Success" });
    const prefixes = new Set(
      readFileSync(join(dir, "calls"), "utf8").match(/[^/ ]+(?=\/script\.sh)/g),
    );
    expect(prefixes.size).toBe(2);
  });

  test("waits while the command is still running", () => {
    const { code, calls } = run({
      FAKE_STATUS: "Success",
      FAKE_IN_PROGRESS_POLLS: "2",
    });
    expect(code).toBe(0);
    expect(calls.match(/get-command-invocation/g)?.length).toBe(4);
  });

  test("waits for a cancel to finish", () => {
    const { code, calls, errors } = run({
      FAKE_STATUS: "Cancelled",
      FAKE_RUNNING_STATUS: "Cancelling",
      FAKE_IN_PROGRESS_POLLS: "2",
    });
    expect(code).toBe(1);
    expect(calls.match(/get-command-invocation/g)?.length).toBe(4);
    expect(errors).toContain("ended Cancelled");
  });

  test("fails with the host's output when the script fails", () => {
    const { code, output } = run({
      FAKE_STATUS: "Failed",
      FAKE_CODE: "3",
      FAKE_STDOUT: "bun install failed",
    });
    expect(code).toBe(1);
    expect(output).toContain("bun install failed");
  });

  test("falls back to Run Command's truncated output when S3 has none", () => {
    const { code, output } = run({ FAKE_STATUS: "TimedOut" });
    expect(code).toBe(1);
    expect(output).toContain("truncated");
  });

  test("says which timeout a timed-out command hit", () => {
    const { errors } = run({
      FAKE_STATUS: "TimedOut",
      FAKE_STATUS_DETAILS: "DeliveryTimedOut",
      FAKE_CODE: "-1",
    });
    expect(errors).toContain("ended TimedOut (DeliveryTimedOut, exit -1)");
  });

  test("fails with the output so far when the command outlasts the wait", () => {
    const { code, output, errors } = run({
      FAKE_STATUS: "Success",
      FAKE_IN_PROGRESS_POLLS: "1000000",
      MAX_WAIT_SECONDS: "1",
    });
    expect(code).toBe(1);
    expect(output).toContain("no full output in S3");
    expect(errors).toContain(
      "still InProgress on the host after the wait deadline",
    );
  });

  test("fails at once on an error other than a missing invocation", () => {
    const { code, calls } = run({
      FAKE_INVOCATION_ERROR: "An error occurred (AccessDeniedException)",
    });
    expect(code).toBe(1);
    expect(calls.match(/get-command-invocation/g)?.length).toBe(1);
  });

  test("on the host, skips deploying when a later-sent command arrives while it waits", () => {
    run({ FAKE_STATUS: "Success" });
    const { code, output, calls } = runOnHost({ arrival: "9999999999 8-1" });
    expect(code).toBe(1);
    expect(output).toContain(
      "run 8-1 sent its deploy-react-app after this one",
    );
    expect(calls).toBe("");
  });

  test("on the host, skips deploying when a later-sent command reached the host first", () => {
    run({ FAKE_STATUS: "Success" });
    const { code, calls } = runOnHost({
      arrival: "",
      queue: "9999999999 8-1\n",
    });
    expect(code).toBe(1);
    expect(calls).toBe("");
  });

  test("on the host, deploys a rerun of an older run, sent after every queued command", () => {
    run({ FAKE_STATUS: "Success", GITHUB_RUN_ATTEMPT: "2" });
    const { code, calls } = runOnHost({ arrival: "", queue: "1 7-1\n2 8-1\n" });
    expect(code).toBe(0);
    expect(calls).toContain("s3 cp --region us-west-2");
  });

  test("on the host, exits with the script's code and prints its output", () => {
    run({ FAKE_STATUS: "Success", SCRIPT: "echo deployed; exit 3" });
    const { code, output } = runOnHost({ arrival: "" });
    expect(code).toBe(3);
    expect(output).toContain("deployed");
  });

  test("on the host, finishes the script after the agent closes its output pipe, as on cancel", () => {
    run({
      FAKE_STATUS: "Success",
      SCRIPT: 'sleep 0.5; echo deployed; touch "$FAKE_DIR/finished"',
    });
    runOnHost({ arrival: "", closedPipe: true });
    expect(existsSync(join(dir, "finished"))).toBe(true);
  });

  test("refuses two files with one base name before touching AWS", () => {
    writeFileSync(join(dir, "calls"), "");
    const { code, errors, calls } = run({
      FILES: `${join(dir, "react-build.zip")}\n${join(dir, "a", "react-build.zip")}\n`,
    });
    expect(code).toBe(1);
    expect(errors).toContain("files share a base name");
    expect(calls).toBe("");
  });

  test("on the host, fails without downloading while an earlier run holds the lock", () => {
    run({ FAKE_STATUS: "Success" });
    const { code, output, calls } = runOnHost({ arrival: "", lockHeld: true });
    expect(code).toBe(1);
    expect(output).toContain(
      "an earlier deploy-react-app is still running on this host",
    );
    expect(calls).toBe("");
  });

  test("refuses a timeout whose wait outlasts the role session before touching AWS", () => {
    writeFileSync(join(dir, "calls"), "");
    const { code, calls } = run({ TIMEOUT_MINUTES: "63" });
    expect(code).toBe(1);
    expect(calls).toBe("");
  });

  test("sends the longest timeout the role session allows", () => {
    const { code, calls } = run({
      TIMEOUT_MINUTES: "62",
      FAKE_STATUS: "Success",
    });
    expect(code).toBe(0);
    expect(calls).toContain("ssm send-command");
  });

  test("refuses a zero timeout, which timeout reads as no limit, before touching AWS", () => {
    writeFileSync(join(dir, "calls"), "");
    const { code, calls } = run({ TIMEOUT_MINUTES: "0" });
    expect(code).toBe(1);
    expect(calls).toBe("");
  });

  test("refuses an unknown environment before touching AWS", () => {
    writeFileSync(join(dir, "calls"), "");
    const { code, calls } = run({ ENVIRONMENT: "dev" });
    expect(code).toBe(1);
    expect(calls).toBe("");
  });
});
