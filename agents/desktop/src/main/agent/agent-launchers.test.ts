import { afterEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../common/src/result";
import { writeAgentLaunchers } from "./agent-launchers";
import { codexConfigArgs } from "./codex/process";
import { testFolders } from "./testing/folders";

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const echoArgs = (name: string) => {
  // A space and a quote in the path check the launcher quotes it.
  const folder = path.join(dir, "it's here");
  mkdirSync(folder, { recursive: true });
  const file = path.join(folder, name);
  writeFileSync(file, "#!/bin/sh\nprintf '%s\\n' \"$@\"\n");
  chmodSync(file, 0o755);
  return file;
};

const folders = () =>
  testFolders({
    bin: path.join(dir, "bin"),
    codexHome: path.join(dir, "codex"),
  });

test("the launchers run each CLI with the arguments they get, codex after the overrides the app's own runs take, and the private CODEX_HOME exists", () => {
  dir = mkdtempSync(path.join(tmpdir(), "launchers-test-"));
  const written = writeAgentLaunchers({
    folders: folders(),
    claude: R.success(echoArgs("claude")),
    codex: R.success(echoArgs("codex")),
  });
  expect(written).toEqual(R.success(undefined));
  const run = (name: string) =>
    execFileSync(path.join(dir, "bin", name), ["a b", "c"], {
      encoding: "utf8",
    }).split("\n");
  expect(run("claude")).toEqual(["a b", "c", ""]);
  expect(run("codex")).toEqual([...codexConfigArgs, "a b", "c", ""]);
  expect(statSync(path.join(dir, "codex")).mode & 0o777).toBe(0o700);
});

test("a launcher for a CLI the app couldn't find fails, printing why verbatim, rather than running another", () => {
  dir = mkdtempSync(path.join(tmpdir(), "launchers-test-"));
  writeAgentLaunchers({
    folders: folders(),
    claude: R.failure(new Error("couldn't find Claude Code's 'b\\cundle'")),
    codex: R.success(echoArgs("codex")),
  });
  const ran = spawnSync(path.join(dir, "bin", "claude"), ["-p"], {
    encoding: "utf8",
  });
  expect(ran.status).toBe(127);
  expect(ran.stderr).toBe(
    "Alliance agent: couldn't find Claude Code's 'b\\cundle'\n",
  );
});

test("a folder it can't write fails, naming it", () => {
  dir = mkdtempSync(path.join(tmpdir(), "launchers-test-"));
  writeFileSync(path.join(dir, "bin"), "");
  const written = writeAgentLaunchers({
    folders: folders(),
    claude: R.success("/claude"),
    codex: R.success("/codex"),
  });
  expect(written.ok ? "" : written.error.message).toStartWith(
    `Alliance agent couldn't write the agents' claude and codex in ${path.join(dir, "bin")}:`,
  );
});
