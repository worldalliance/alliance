import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import type { Conversation } from "../../../shared/conversation";
import type { StartInput } from "../../../shared/ipc";
import type { TasksState } from "../../../shared/task";
import { gitEnvironment } from "../../git-environment";
import { findOnPath } from "../../path-search";
import { gitAt } from "../../repository/git";
import { git, makeSource } from "../../repository/testing/fixture";
import { TaskService } from "../service";
import { TaskStore } from "../store";
import { commitWorktreeScripts } from "./fixture";

export let dir: string;
export let source: string;
export let checkout: string;
export let started: StartInput[];
export let closedIn: string[];
let onClose: (() => void | Promise<void>) | undefined;

/** Runs run each time the service closes a folder's sessions, in this test. */
export const setOnClose = (run: () => void | Promise<void>): void => {
  onClose = run;
};

const bunExecutable = findOnPath("bun", process.env);
if (!bunExecutable) throw new Error("the tests need bun on PATH");

/** A TaskService on this test's checkout, whose conversations start in name only, recorded in started, and whose closes are recorded in closedIn. */
export function service(params: { checkout?: () => string | undefined } = {}) {
  const tasks = new TaskService({
    checkout: params.checkout ?? (() => checkout),
    repositoryUrl: source,
    findGit: async () =>
      R.success(gitAt({ executable: "git", env: process.env })),
    findBun: () =>
      R.success({ executable: bunExecutable ?? "", env: gitEnvironment() }),
    store: new TaskStore(path.join(dir, "user-data", "tasks.json")),
    startConversation: async (input) => {
      started.push(input);
      return R.success({
        id: `session-${started.length}`,
        folder: input.folder,
        title: input.firstMessage,
        startedAt: "2026-11-22T12:00:00.000Z",
        agent: input.agent,
      } satisfies Conversation);
    },
    closeSessionsIn: async (folder) => {
      closedIn.push(folder);
      await onClose?.();
    },
  });
  const states: TasksState[] = [];
  tasks.subscribe((state) => states.push(state));
  return { tasks, states };
}

/** Gives the test its own fixture repository, with the fake worktree scripts, cloned to checkout; run it before each test. */
export function setUp(): void {
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), "tasks-")));
  source = path.join(dir, "source");
  makeSource({ folder: source, defaultFolder: path.join(dir, "unused") });
  commitWorktreeScripts(source);
  checkout = path.join(dir, "workspaces", "alliance");
  git(dir, "clone", "-q", source, checkout);
  started = [];
  closedIn = [];
  onClose = undefined;
}

export const tearDown = (): void =>
  rmSync(dir, { recursive: true, force: true });
