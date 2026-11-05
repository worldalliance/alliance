import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hook = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "block-pkill.sh",
);

function decide(command: string): string | undefined {
  const run = spawnSync(hook, {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });
  expect(run.status).toBe(0);
  if (run.stdout === "") return undefined;
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecision;
}

test.each([
  'pkill -TERM -f "bun src/main.ts" -n',
  "killall node",
  "cd server; pkill bun",
  "git check-ignore .scratch && pkill -f x",
  "/usr/bin/pkill -f x",
  "sudo killall Dock",
  "(pkill x)",
  '"pkill" -f x',
  "killall;",
  'git commit -m "Block pkill and killall"',
  "kill $(pgrep -f x -n)",
  "kill -9 `pgrep x`",
  "pgrep -f x | xargs kill",
  "pgrep -f x | xargs -0 kill -9",
  "pgrep -f x | xargs /bin/kill",
  "kill $(/usr/bin/pgrep -f x)",
  'pgrep -f "bun src/main.ts" \\\n  | xargs kill',
  "pgrep -f x |\n  xargs kill",
  "kill $(\n  pgrep -f x)",
  "pgrep -f 'a|b' | xargs kill",
  "pgrep x | sort | xargs kill",
  "kill $(sudo pgrep x)",
  "pgrep -f x | xargs kill;",
  "(pgrep -f x | xargs kill)",
  "pgrep -f x | xargs kill&& echo ok",
  'pgrep -f x | xargs "kill"',
  'pgrep -f x | "xargs" kill',
  '"pgrep" -f x | xargs kill',
  'kill $("pgrep" -f x)',
  "kill $(pgrep)",
])("denies %s", (command) => {
  expect(decide(command)).toBe("deny");
});

test.each([
  'pgrep -fl "bun src/main.ts"',
  "pgrep -fl x | head",
  "kill 1234",
  "kill -TERM 1234 5678",
  "ls skill-files",
  "cat agents/hooks/block-pkill.sh",
  "cd ../alliance-pkill-guard",
  "echo $(cat my-pgrep.txt)",
  "cat pgrep-notes | xargs kill-switch",
  "",
])("allows %s", (command) => {
  expect(decide(command)).toBeUndefined();
});

test("the denial tells the agent to list candidates with pgrep first", () => {
  const run = spawnSync(hook, {
    input: JSON.stringify({ tool_input: { command: "pkill x" } }),
    encoding: "utf8",
  });
  expect(
    JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason,
  ).toContain("pgrep -fl");
});

test("blocks the call when jq is missing", () => {
  const run = spawnSync("/bin/bash", [hook], {
    input: JSON.stringify({ tool_input: { command: "kill 1234" } }),
    encoding: "utf8",
    env: { PATH: "/nonexistent" },
  });
  expect(run.status).toBe(2);
  expect(run.stderr).toContain("needs jq");
});
