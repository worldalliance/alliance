import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { AgentKind } from "../../shared/agent-kind";
import { CreationStage, TaskStatus } from "../../shared/task";
import { commitFile, git } from "../repository/testing/fixture";
import { steeringFile } from "./testing/fixture";
import {
  checkout,
  dir,
  service,
  setUp,
  source,
  started,
  tearDown,
} from "./testing/service-fixture";

beforeEach(setUp);
afterEach(tearDown);

test("creates a task's worktree from the latest main, reports each stage, then starts its first conversation, recording which task its creation became", async () => {
  const latest = commitFile({
    folder: source,
    file: "later.txt",
    message: "Later",
  });
  const { tasks, states } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix the signup copy",
    agent: AgentKind.Codex,
  });
  const folder = path.join(dir, "workspaces", "alliance-fix-the-signup-copy");
  expect(created).toEqual({
    ok: true,
    value: {
      key: "id-fix-the-signup-copy",
      folder,
      conversation: expect.objectContaining({ ok: true }),
    },
  });
  expect(git(folder, "rev-parse", "HEAD")).toBe(latest);
  expect(started).toEqual([
    { folder, firstMessage: "Fix the signup copy", agent: AgentKind.Codex },
  ]);
  const stages = states.flatMap(({ tasks }) =>
    tasks.flatMap(({ key, state }) =>
      key === "new:c1" && state.status === TaskStatus.Creating
        ? [state.stage]
        : [],
    ),
  );
  expect([...new Set(stages)]).toEqual([
    CreationStage.Downloading,
    CreationStage.CopyingDatabase,
    CreationStage.CreatingFolder,
    CreationStage.InstallingDependencies,
    CreationStage.StartingAgent,
  ]);
  expect(tasks.current().tasks).toEqual([
    expect.objectContaining({
      key: "id-fix-the-signup-copy",
      title: "Fix the signup copy",
      createdByApp: true,
    }),
  ]);
  expect(tasks.current().created).toEqual({
    "new:c1": "id-fix-the-signup-copy",
  });
});

test("names a task so it reuses no branch, even one a tag shares a name with, or branch folder, since the script would check an existing one out and git can't create the other", async () => {
  git(checkout, "branch", "fix-it");
  git(checkout, "branch", "fix-it-2/login");
  git(checkout, "branch", "fix-it-3");
  git(checkout, "tag", "fix-it-3");
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(created.ok && created.value.folder).toEndWith("alliance-fix-it-4");
});

test("a failed creation stays listed with its request and leftover until retried under a new name", async () => {
  const fail = steeringFile(checkout, "fake-fail");
  writeFileSync(fail, "");
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(!created.ok && created.error.details).toContain(
    "copying settings failed on purpose",
  );
  const [failed, ...others] = tasks.current().tasks;
  expect(others).toEqual([]);
  expect(failed).toMatchObject({
    key: "new:c1",
    state: {
      status: TaskStatus.CreateFailed,
      request: "Fix it",
      leftover: expect.stringContaining(
        `Part of it was created: ${path.join(dir, "workspaces", "alliance-fix-it")}.`,
      ),
    },
  });

  rmSync(fail);
  const retried = await tasks.retry("new:c1");
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it-2");
  expect(
    tasks.current().tasks.map((t) => [t.title, t.state.status, t.createdByApp]),
  ).toEqual([
    ["Fix it", TaskStatus.NotFinished, true],
    ["Fix it", TaskStatus.Ready, true],
  ]);
});

test("a failed creation whose leftover couldn't be listed says so rather than that nothing was created", async () => {
  writeFileSync(steeringFile(checkout, "fake-fail"), "");
  const hold = steeringFile(checkout, "fake-hold");
  writeFileSync(hold, "");
  const { tasks } = service();
  const created = tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  writeFileSync(steeringFile(checkout, "fake-list-fails"), "");
  rmSync(hold);
  expect((await created).ok).toBe(false);
  expect(tasks.current().tasks[0]?.state).toMatchObject({
    status: TaskStatus.CreateFailed,
    leftover: expect.stringContaining("listing failed on purpose"),
  });
});

test("a creation whose worktree was made but couldn't be listed finds it on retry rather than making another", async () => {
  const hold = steeringFile(checkout, "fake-hold");
  const listFails = steeringFile(checkout, "fake-list-fails");
  writeFileSync(hold, "");
  const { tasks } = service();
  const created = tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  writeFileSync(listFails, "");
  rmSync(hold);
  expect((await created).ok).toBe(false);
  expect(tasks.current().tasks).toMatchObject([
    {
      key: "new:c1",
      state: {
        status: TaskStatus.CreateFailed,
        leftover: expect.stringContaining("fix-it was created."),
        made: true,
      },
    },
  ]);
  tasks.dismiss("new:c1");
  expect(tasks.current().tasks.map((t) => t.key)).toEqual(["new:c1"]);

  rmSync(listFails);
  const retried = await tasks.retry("new:c1");
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it");
  expect(readFileSync(args, "utf8").trim().split("\n")).toHaveLength(1);
  expect(tasks.current().tasks.map((t) => [t.title, t.state.status])).toEqual([
    ["Fix it", TaskStatus.Ready],
  ]);
});

test("a creation finishes in its own checkout while the repository is checked again", async () => {
  const hold = steeringFile(checkout, "fake-hold");
  writeFileSync(hold, "");
  let ready = true;
  const { tasks } = service({ checkout: () => (ready ? checkout : undefined) });
  const created = tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  ready = false;
  rmSync(hold);
  const result = await created;
  expect(result.ok && result.value.folder).toEndWith("alliance-fix-it");
  expect(readFileSync(args, "utf8").trim().split("\n")).toHaveLength(1);
});

test("a creation whose title can't be saved fails, keeps saying what it made while the repository isn't ready, and Try again saves it without making another worktree", async () => {
  const saved = path.join(dir, "user-data", "tasks.json");
  mkdirSync(path.dirname(saved), { recursive: true });
  writeFileSync(saved, "not json");
  let ready = true;
  const { tasks } = service({ checkout: () => (ready ? checkout : undefined) });
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(!created.ok && created.error.message).toBe(
    "Alliance agent created fix-it, but couldn't save it as a task it created.",
  );
  expect(started).toEqual([]);
  expect(tasks.current().tasks).toContainEqual(
    expect.objectContaining({
      key: "new:c1",
      state: expect.objectContaining({
        status: TaskStatus.CreateFailed,
        leftover: expect.stringContaining("fix-it was created."),
      }),
    }),
  );

  ready = false;
  expect((await tasks.retry("new:c1")).ok).toBe(false);
  expect(tasks.current().tasks[0]?.state).toMatchObject({
    leftover: expect.stringContaining("fix-it was created."),
  });

  ready = true;
  rmSync(saved);
  const retrying = tasks.retry("new:c1");
  expect(tasks.current().tasks[0]?.state).toEqual({
    status: TaskStatus.Creating,
    stage: CreationStage.StartingAgent,
  });
  const retried = await retrying;
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it");
  const args = steeringFile(checkout, "fake-new-worktree-args");
  expect(readFileSync(args, "utf8").trim().split("\n")).toHaveLength(1);
  expect(tasks.current().tasks.map((t) => [t.title, t.createdByApp])).toEqual([
    ["Fix it", true],
  ]);
});

test("a made creation whose worktree is gone by Try again makes another rather than staying stuck", async () => {
  const saved = path.join(dir, "user-data", "tasks.json");
  mkdirSync(path.dirname(saved), { recursive: true });
  writeFileSync(saved, "not json");
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(created.ok).toBe(false);
  rmSync(saved);
  const folder = path.join(dir, "workspaces", "alliance-fix-it");
  git(checkout, "worktree", "remove", "--force", folder);

  expect((await tasks.retry("new:c1")).ok).toBe(false);
  expect(tasks.current().tasks[0]?.state).toMatchObject({
    status: TaskStatus.CreateFailed,
    made: false,
    leftover: undefined,
  });
  const retried = await tasks.retry("new:c1");
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it-2");
});

test("retrying a name the script refused before creating anything tries another", async () => {
  const blocking = path.join(dir, "workspaces", "alliance-fix-it");
  mkdirSync(blocking, { recursive: true });
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(!created.ok && created.error.details).toContain("already exists");
  const { tasks: _, ...beforeRetry } = tasks.current();
  const retrying = tasks.retry("new:c1");
  expect(tasks.current()).toEqual({
    ...beforeRetry,
    tasks: [
      {
        key: "new:c1",
        title: "Fix it",
        createdByApp: true,
        archived: false,
        state: {
          status: TaskStatus.Creating,
          stage: CreationStage.Downloading,
        },
      },
    ],
  });
  const retried = await retrying;
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it-2");
});

test("two creations of the same request at once get different names", async () => {
  const { tasks } = service();
  const created = await Promise.all(
    ["c1", "c2"].map((creationId) =>
      tasks.create({ creationId, request: "Fix it", agent: AgentKind.Claude }),
    ),
  );
  expect(
    created.map((c) => c.ok && path.basename(c.value.folder)).sort(),
  ).toEqual(["alliance-fix-it", "alliance-fix-it-2"]);
});

test("dismissing a failed creation shows what it left behind as a task of its own", async () => {
  writeFileSync(steeringFile(checkout, "fake-fail"), "");
  const { tasks } = service();
  await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  tasks.dismiss("new:c1");
  expect(tasks.current().tasks).toEqual([
    expect.objectContaining({
      key: "id-fix-it",
      title: "Fix it",
      createdByApp: true,
      state: { status: TaskStatus.NotFinished },
    }),
  ]);
});

test("a failed download creates nothing", async () => {
  rmSync(source, { recursive: true, force: true });
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(!created.ok && created.error.message).toContain(
    "couldn't download the latest main",
  );
  expect(existsSync(steeringFile(checkout, "fake-new-worktree-args"))).toBe(
    false,
  );
  expect(tasks.current().tasks[0]?.state).toMatchObject({
    status: TaskStatus.CreateFailed,
    leftover: undefined,
  });
});

test("closing stops a creation in progress and waits for it", async () => {
  writeFileSync(steeringFile(checkout, "fake-hold"), "");
  const { tasks } = service();
  const created = tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  await tasks.close();
  expect((await created).ok).toBe(false);
  expect(started).toEqual([]);
  expect(readFileSync(args, "utf8")).toStartWith("fix-it --from ");
});
