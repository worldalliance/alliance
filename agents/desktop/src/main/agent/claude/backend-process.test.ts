import { afterAll, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import { type AgentEvent, AgentEventKind } from "../session";
import { createClaudeBackend } from "./backend";
import type { ClaudeCli } from "./process";
import { CLAUDE_CODE_VERSION } from "./protocol";
import { stubCli as cli } from "./testing/stub";
import { text, turn } from "./testing/turn";

const scratch = mkdtempSync(
  path.join(tmpdir(), "claude-backend-process-test-"),
);

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

test("a turn that finishes before its interrupt reaches the CLI ends as not interrupted", async () => {
  const session = R.unwrap(
    await createClaudeBackend(
      shellCli(
        `read message; read interrupt; echo '{"type":"result","subtype":"success","is_error":false}'; read eof`,
      ),
    ).start({ cwd: scratch }),
  );
  const ended = new Promise<AgentEvent>((resolve) =>
    session.subscribe((event) => {
      if (event.kind === AgentEventKind.TurnEnded) resolve(event);
    }),
  );
  R.unwrap(session.send(text("Hello")));
  session.interrupt();
  expect(await ended).toEqual({
    kind: AgentEventKind.TurnEnded,
    interrupted: false,
  });
  await session.close();
});

test("a turn the CLI fails without an interrupt ends as not interrupted", async () => {
  const session = R.unwrap(
    await createClaudeBackend(
      shellCli(
        `read message; echo '{"type":"result","subtype":"error_during_execution","is_error":true,"errors":["boom"]}'; read eof`,
      ),
    ).start({ cwd: scratch }),
  );
  expect(await turn({ session, message: text("Hello") })).toEqual([
    { kind: AgentEventKind.Error, message: "boom" },
    { kind: AgentEventKind.TurnEnded, interrupted: false },
  ]);
  await session.close();
});

test("a CLI that exits after an interrupt but before its result ends the turn as not interrupted", async () => {
  const session = R.unwrap(
    await createClaudeBackend(
      shellCli("read message; read interrupt; echo boom >&2; exit 3"),
    ).start({ cwd: scratch }),
  );
  const events = turn({ session, message: text("Hello") });
  session.interrupt();
  expect(await events).toEqual([
    {
      kind: AgentEventKind.Error,
      message: "Claude Code exited (code 3).\nboom",
    },
    { kind: AgentEventKind.TurnEnded, interrupted: false },
  ]);
});

function shellCli(session: string): ClaudeCli {
  const executable = path.join(scratch, `${randomUUID()}.sh`);
  writeFileSync(
    executable,
    `#!/bin/sh\nif [ "$1" = --version ]; then echo "${CLAUDE_CODE_VERSION} (Claude Code)"; exit 0; fi\n${session}\n`,
    { mode: 0o755 },
  );
  return { ...cli, executable };
}

const isRunning = (pid: number) =>
  R.fromThrowable(() => process.kill(pid, 0)).ok;

test("a CLI that exits while a process it started holds its output open still ends the turn", async () => {
  const pidFile = path.join(scratch, `${randomUUID()}.pid`);
  const session = R.unwrap(
    await createClaudeBackend(
      shellCli(
        `read line; sleep 30 & echo $! > ${pidFile}; echo gone >&2; exit 1`,
      ),
    ).start({ cwd: scratch }),
  );
  const events = await turn({ session, message: text("Hello") });
  process.kill(Number(readFileSync(pidFile, "utf8")));
  expect(events).toEqual([
    {
      kind: AgentEventKind.Error,
      message: "Claude Code exited (code 1).\ngone",
    },
    { kind: AgentEventKind.TurnEnded, interrupted: false },
  ]);
});

test("close kills a CLI that ignores both stdin closing and SIGTERM", async () => {
  const pidFile = path.join(scratch, `${randomUUID()}.pid`);
  const session = R.unwrap(
    await createClaudeBackend(
      shellCli(`trap '' TERM; echo $$ > ${pidFile}; exec sleep 30`),
      { killAfterMs: 100 },
    ).start({ cwd: scratch }),
  );
  while (!existsSync(pidFile)) await Bun.sleep(10);
  const events: AgentEvent[] = [];
  session.subscribe((event) => events.push(event));
  R.unwrap(session.send(text("Hello")));
  await session.close();
  expect(isRunning(Number(readFileSync(pidFile, "utf8")))).toBe(false);
  expect(events).toEqual([
    { kind: AgentEventKind.TurnEnded, interrupted: true },
  ]);
});

test("close sends SIGTERM to an idle CLI that outlives its stdin closing", async () => {
  const pidFile = path.join(scratch, `${randomUUID()}.pid`);
  const termFile = path.join(scratch, `${randomUUID()}.term`);
  const session = R.unwrap(
    await createClaudeBackend(
      shellCli(
        `trap 'touch ${termFile}; exit 0' TERM; echo $$ > ${pidFile}; while :; do sleep 0.05; done`,
      ),
      { killAfterMs: 100 },
    ).start({ cwd: scratch }),
  );
  while (!existsSync(pidFile)) await Bun.sleep(10);
  await session.close();
  expect(existsSync(termFile)).toBe(true);
});

test("close kills an idle CLI that ignores both stdin closing and SIGTERM", async () => {
  const pidFile = path.join(scratch, `${randomUUID()}.pid`);
  const session = R.unwrap(
    await createClaudeBackend(
      shellCli(
        `trap '' TERM; echo $$ > ${pidFile}; while :; do sleep 0.05; done`,
      ),
      { killAfterMs: 100 },
    ).start({ cwd: scratch }),
  );
  while (!existsSync(pidFile)) await Bun.sleep(10);
  await session.close();
  expect(isRunning(Number(readFileSync(pidFile, "utf8")))).toBe(false);
});

test("close reports no Error for output the CLI can't read as it stops", async () => {
  const readyFile = path.join(scratch, `${randomUUID()}.ready`);
  const session = R.unwrap(
    await createClaudeBackend(
      shellCli(
        `trap 'echo garbage; exit 0' TERM; touch ${readyFile}; while :; do sleep 0.05; done`,
      ),
    ).start({ cwd: scratch }),
  );
  while (!existsSync(readyFile)) await Bun.sleep(10);
  const events: AgentEvent[] = [];
  session.subscribe((event) => events.push(event));
  const logged = spyOn(console, "error").mockImplementation(() => undefined);
  R.unwrap(session.send(text("Hello")));
  await session.close();
  const logs = logged.mock.calls.length;
  logged.mockRestore();
  expect(events).toEqual([
    { kind: AgentEventKind.TurnEnded, interrupted: true },
  ]);
  expect(logs).toBe(1);
});
