import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "deploy", "nginx", "check-cert.sh");

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "check-cert-"));
  writeFileSync(
    join(dir, "openssl"),
    `#!/usr/bin/env bash
[ -n "$SANS" ] || { echo "Could not open file" >&2; exit 1; }
printf 'X509v3 Subject Alternative Name: \\n    %s\\n' "$SANS"
`,
  );
  chmodSync(join(dir, "openssl"), 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

function run(sans: string, args: string[]) {
  const result = Bun.spawnSync(["bash", SCRIPT, ...args], {
    env: { PATH: `${dir}:${process.env.PATH}`, SANS: sans },
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

const NAMES = ["admin.a.org", "admin.a.org", "admin.b.org"];

test("passes when the certificate covers every name", () => {
  expect(run("DNS:admin.a.org, DNS:admin.b.org", NAMES)).toEqual({
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
});

test("names only the missing ones, and prints a command naming them all", () => {
  const { exitCode, stdout } = run("DNS:admin.a.org", NAMES);
  expect(exitCode).toBe(1);
  expect(stdout).toBe(
    "/etc/letsencrypt/live/admin.a.org/fullchain.pem is missing or does not cover admin.b.org. Issue the cert on this box, then re-run this job:\n" +
      "  sudo certbot certonly --webroot -w /var/www/certbot --cert-name admin.a.org --expand -d admin.a.org -d admin.b.org\n",
  );
});

test("rejects a SAN that only contains the name", () => {
  const { exitCode, stdout } = run(
    "DNS:admin.b.org.evil, DNS:xadmin.b.org, DNS:admin.a.org",
    NAMES,
  );
  expect(exitCode).toBe(1);
  expect(stdout).toContain("does not cover admin.b.org.");
});

test("reports every name when the lineage is missing", () => {
  const { exitCode, stdout } = run("", NAMES);
  expect(exitCode).toBe(1);
  expect(stdout).toContain("does not cover admin.a.org admin.b.org.");
});

test("refuses to run without a lineage and a name", () => {
  const { exitCode, stderr } = run("DNS:admin.a.org", ["admin.a.org"]);
  expect(exitCode).toBe(2);
  expect(stderr).toBe("usage: check-cert.sh <lineage> <name>...\n");
});
