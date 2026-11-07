import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = `${import.meta.dir}/reject-github-secrets.sh`;

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "reject-github-secrets-"));
});
afterEach(() => rmSync(dir, { recursive: true }));

function check(line: string) {
  writeFileSync(join(dir, "workflow.yaml"), `${line}\n`);
  return Bun.spawnSync([SCRIPT, dir]).exitCode;
}

describe("reject-github-secrets.sh", () => {
  test.each([
    `token: \${{ secrets.FOO }}`,
    `token: \${{ SECRETS.FOO }}`,
    `token: \${{ secrets.GITHUB_TOKEN_X }}`,
    `all: \${{ secrets.* }}`,
    `all: \${{ toJSON(secrets) }}`,
    `all: \${{ join(secrets, ',') }}`,
    `all: \${{ format('{0}{1}', secrets, 'x') }}`,
    `token: \${{ secrets['FOO'] }}`,
    `all: \${{ secrets }}`,
    `if: \${{ secrets == '' }}`,
    `if: \${{ secrets < 'a' }}`,
    `if: \${{ secrets >= 'a' }}`,
    `if: \${{ secrets && true }}`,
    `if: \${{ secrets || true }}`,
    `secrets: inherit`,
    `secrets: 'inherit'`,
    `secrets : "inherit"`,
    `# keys, secrets, and tokens`,
  ])("fails on %s", (line) => {
    expect(check(line)).toBe(1);
  });

  test.each([
    `token: \${{ secrets.GITHUB_TOKEN }}`,
    `token: \${{ secrets.github_token }}`,
    `value: \${{ steps.aws.outputs.secrets }}`,
    `# see docs/ci-secrets.md`,
    `# read from Parameter Store, not GitHub secrets.`,
    `# secrets, then variables`,
  ])("passes %s", (line) => {
    expect(check(line)).toBe(0);
  });

  test("ignores files other than YAML", () => {
    writeFileSync(join(dir, "read.sh"), 'echo "${secrets}"\n');
    expect(Bun.spawnSync([SCRIPT, dir]).exitCode).toBe(0);
  });

  test("fails when grep errors", () => {
    writeFileSync(join(dir, "workflow.yaml"), "");
    chmodSync(join(dir, "workflow.yaml"), 0);
    expect(Bun.spawnSync([SCRIPT, dir]).exitCode).not.toBe(0);
  });

  test("fails on a missing directory", () => {
    expect(Bun.spawnSync([SCRIPT, join(dir, "missing")]).exitCode).toBe(1);
  });
});
