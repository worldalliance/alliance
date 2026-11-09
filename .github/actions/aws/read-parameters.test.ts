import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "read-parameters-"));
  writeFileSync(
    join(dir, "aws"),
    `#!/usr/bin/env bash\necho "$*" > "$FAKE_DIR/args"\ncat "$FAKE_DIR/response"\n`,
  );
  chmodSync(join(dir, "aws"), 0o755);
  writeFileSync(join(dir, "output"), "");
});

afterEach(() => rmSync(dir, { recursive: true }));

function read(params: { names: string; response: object }) {
  writeFileSync(join(dir, "response"), JSON.stringify(params.response));
  const result = Bun.spawnSync(
    ["bash", `${import.meta.dir}/read-parameters.sh`],
    {
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        FAKE_DIR: dir,
        PARAMETERS: params.names,
        GITHUB_OUTPUT: join(dir, "output"),
      },
    },
  );
  return {
    code: result.exitCode,
    log: result.stdout.toString() + result.stderr.toString(),
    output: readFileSync(join(dir, "output"), "utf8"),
  };
}

function secretsOutput(output: string): Record<string, string> {
  const [, json] = output.split("\n");
  return JSON.parse(json);
}

describe("read-parameters", () => {
  test("asks for the names under /alliance/ and outputs the values by last segment", () => {
    const { code, output } = read({
      names:
        "  ci/review/OPENAI_API_KEY\n\nci/shared/SLACK_WEBHOOK_URL_DEPLOYMENT\n",
      response: {
        Parameters: [
          { Name: "/alliance/ci/review/OPENAI_API_KEY", Value: "sk-1" },
          {
            Name: "/alliance/ci/shared/SLACK_WEBHOOK_URL_DEPLOYMENT",
            Value: "https://hooks.example/x",
          },
        ],
        InvalidParameters: [],
      },
    });
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "args"), "utf8").trim()).toBe(
      "ssm get-parameters --with-decryption --output json --names /alliance/ci/review/OPENAI_API_KEY /alliance/ci/shared/SLACK_WEBHOOK_URL_DEPLOYMENT",
    );
    expect(secretsOutput(output)).toEqual({
      OPENAI_API_KEY: "sk-1",
      SLACK_WEBHOOK_URL_DEPLOYMENT: "https://hooks.example/x",
    });
  });

  test("masks every line of a multi-line value that could hold key material", () => {
    const { code, log, output } = read({
      names: "staging/ci/PLAY_SERVICE_ACCOUNT_JSON",
      response: {
        Parameters: [
          {
            Name: "/alliance/staging/ci/PLAY_SERVICE_ACCOUNT_JSON",
            Value: '{\n  "private_key": "abc"\n}',
          },
        ],
        InvalidParameters: [],
      },
    });
    expect(code).toBe(0);
    expect(log).toContain('::add-mask::  "private_key": "abc"');
    expect(log).not.toContain("::add-mask::{");
    expect(log).not.toContain("::add-mask::}");
    expect(secretsOutput(output).PLAY_SERVICE_ACCOUNT_JSON).toBe(
      '{\n  "private_key": "abc"\n}',
    );
  });

  test("masks a single-line value with no letter or digit", () => {
    const { log } = read({
      names: "ci/review/OPENAI_API_KEY",
      response: {
        Parameters: [
          { Name: "/alliance/ci/review/OPENAI_API_KEY", Value: "!@#$^&*()" },
        ],
        InvalidParameters: [],
      },
    });
    expect(log).toContain("::add-mask::!@#$^&*()\n");
  });

  test("escapes what the runner unescapes in a mask", () => {
    const { log } = read({
      names: "ci/review/OPENAI_API_KEY",
      response: {
        Parameters: [
          {
            Name: "/alliance/ci/review/OPENAI_API_KEY",
            Value: "pa%25ss%0Aword\r",
          },
        ],
        InvalidParameters: [],
      },
    });
    expect(log).toContain("::add-mask::pa%2525ss%250Aword%0D\n");
  });

  test("fails naming the parameters Parameter Store lacks", () => {
    const { code, log, output } = read({
      names: "ci/review/OPENAI_API_KEY",
      response: {
        Parameters: [],
        InvalidParameters: ["/alliance/ci/review/OPENAI_API_KEY"],
      },
    });
    expect(code).toBe(1);
    expect(log).toContain(
      "not in Parameter Store: /alliance/ci/review/OPENAI_API_KEY",
    );
    expect(output).toBe("");
  });

  test("fails before calling AWS when two names share a last segment", () => {
    const { code, log } = read({
      names: "ci/review/TOKEN\nci/shared/TOKEN",
      response: {},
    });
    expect(code).toBe(1);
    expect(log).toContain("share a last segment: TOKEN");
    expect(() => readFileSync(join(dir, "args"))).toThrow();
  });

  test("fails when given no names", () => {
    expect(read({ names: "\n", response: {} }).code).toBe(1);
  });
});
