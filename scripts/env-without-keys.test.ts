import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { R } from "../common/src/result";
import { withoutKeys } from "./env-without-keys";

const PORT = /^PORT$/;

const strip = (src: string) => R.unwrap(withoutKeys(src, PORT));

test("withoutKeys removes every form dotenv reads as the key", () => {
  expect(
    strip(
      'PORT=1\nexport PORT = 2\nPORT: 3\n  PORT=4 # note\nexport\tPORT=5\nPORT="6\n7"\nA=1\n',
    ),
  ).toBe("A=1\n");
});

test("withoutKeys keeps what only looks like the key", () => {
  const src =
    "A='x\nPORT=9\n'\nPORT.X=1\nXPORT=1\n#PORT=old\n# PORT: old\nB=2\n";
  expect(strip(src)).toBe(src);
});

test("withoutKeys keeps the comment after an empty value", () => {
  expect(strip("PORT=\n# note\nB=1\n")).toBe("# note\nB=1\n");
});

test("withoutKeys reads CRLF files and writes LF", () => {
  expect(strip("A=1\r\nPORT=2\r\nB=3\r\n")).toBe("A=1\nB=3\n");
});

test("withoutKeys removes only the line of an unclosed quote", () => {
  expect(strip('PORT="1\nB=2\n')).toBe("B=2\n");
});

test("withoutKeys removes the key that removing an entry rejoins", () => {
  expect(strip("PORT\nPORT=9\n= 4\nB=1\n")).toBe("B=1\n");
});

test("withoutKeys ignores a global pattern's last index", () => {
  expect(R.unwrap(withoutKeys("PORT=1\nPORT=2\nPORT=3\n", /^PORT$/g))).toBe("");
});

test("withoutKeys fails when removing an entry joins others into a new one", () => {
  expect(withoutKeys("A\nPORT=1\n=5\n", PORT)).toEqual(
    R.failure(expect.stringContaining("changed others")),
  );
});

const dir = mkdtempSync(join(tmpdir(), "env-without-keys-"));
afterAll(() => rmSync(dir, { recursive: true }));

const cli = (src: string, pattern: string) => {
  const file = join(dir, ".env");
  writeFileSync(file, src);
  const run = Bun.spawnSync([
    process.execPath,
    join(import.meta.dir, "env-without-keys.ts"),
    file,
    pattern,
  ]);
  return { file, run };
};

test("the CLI matches only whole keys", () => {
  expect(
    cli("XPORT=1\nPORT=2\nX=3\nAPORTB=4\n", "PORT|X").run.stdout.toString(),
  ).toBe("XPORT=1\nAPORTB=4\n");
});

test("the CLI exits 1 naming the file when withoutKeys fails", () => {
  const { file, run } = cli("A\nPORT=1\n=5\n", "PORT");
  expect(run.exitCode).toBe(1);
  expect(run.stdout.toString()).toBe("");
  expect(run.stderr.toString()).toContain(
    `${file}: removing the entries changed others`,
  );
});
