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
import { CreationStage, WorktreeStatus } from "../../shared/worktree";
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

test("creates a worktree from the latest main, reports each stage, then starts its first conversation, recording which worktree its creation became", async () => {
  const latest = commitFile({
    folder: source,
    file: "later.txt",
    message: "Later",
  });
  const { worktrees, states } = service();
  const created = await worktrees.create({
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
  const stages = states.flatMap(({ worktrees }) =>
    worktrees.flatMap(({ key, state }) =>
      key === "new:c1" && state.status === WorktreeStatus.Creating
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
  expect(worktrees.current().worktrees).toEqual([
    expect.objectContaining({
      key: "id-fix-the-signup-copy",
      title: "Fix the signup copy",
      createdByApp: true,
    }),
  ]);
  expect(worktrees.current().created).toEqual({
    "new:c1": "id-fix-the-signup-copy",
  });
});

test("names a worktree so it reuses no branch, even one a tag shares a name with, or branch folder, since the script would check an existing one out and git can't create the other", async () => {
  git(checkout, "branch", "fix-it");
  git(checkout, "branch", "fix-it-2/login");
  git(checkout, "branch", "fix-it-3");
  git(checkout, "tag", "fix-it-3");
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(created.ok && created.value.folder).toEndWith("alliance-fix-it-4");
});

test("a failed creation stays listed with its request and leftover until retried under a new name", async () => {
  const fail = steeringFile(checkout, "fake-fail");
  writeFileSync(fail, "");
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(!created.ok && created.error.details).toContain(
    "copying settings failed on purpose",
  );
  const [failed, ...others] = worktrees.current().worktrees;
  expect(others).toEqual([]);
  expect(failed).toMatchObject({
    key: "new:c1",
    state: {
      status: WorktreeStatus.CreateFailed,
      request: "Fix it",
      leftover: expect.stringContaining(
        `Part of it was created: ${path.join(dir, "workspaces", "alliance-fix-it")}.`,
      ),
    },
  });

  rmSync(fail);
  const retried = await worktrees.retry("new:c1");
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it-2");
  expect(
    worktrees
      .current()
      .worktrees.map((t) => [t.title, t.state.status, t.createdByApp]),
  ).toEqual([
    ["Fix it", WorktreeStatus.NotFinished, true],
    ["Fix it", WorktreeStatus.Ready, true],
  ]);
});

test("a failed creation whose leftover couldn't be listed says so rather than that nothing was created", async () => {
  writeFileSync(steeringFile(checkout, "fake-fail"), "");
  const hold = steeringFile(checkout, "fake-hold");
  writeFileSync(hold, "");
  const { worktrees } = service();
  const created = worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  writeFileSync(steeringFile(checkout, "fake-list-fails"), "");
  rmSync(hold);
  expect((await created).ok).toBe(false);
  expect(worktrees.current().worktrees[0]?.state).toMatchObject({
    status: WorktreeStatus.CreateFailed,
    leftover: expect.stringContaining("listing failed on purpose"),
  });
});

test("a creation whose worktree was made but couldn't be listed finds it on retry rather than making another", async () => {
  const hold = steeringFile(checkout, "fake-hold");
  const listFails = steeringFile(checkout, "fake-list-fails");
  writeFileSync(hold, "");
  const { worktrees } = service();
  const created = worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  writeFileSync(listFails, "");
  rmSync(hold);
  expect((await created).ok).toBe(false);
  expect(worktrees.current().worktrees).toMatchObject([
    {
      key: "new:c1",
      state: {
        status: WorktreeStatus.CreateFailed,
        leftover: expect.stringContaining("fix-it was created."),
        made: true,
      },
    },
  ]);
  worktrees.dismiss("new:c1");
  expect(worktrees.current().worktrees.map((t) => t.key)).toEqual(["new:c1"]);

  rmSync(listFails);
  const retried = await worktrees.retry("new:c1");
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it");
  expect(readFileSync(args, "utf8").trim().split("\n")).toHaveLength(1);
  expect(
    worktrees.current().worktrees.map((t) => [t.title, t.state.status]),
  ).toEqual([["Fix it", WorktreeStatus.Ready]]);
});

test("a creation finishes in its own checkout while the repository is checked again", async () => {
  const hold = steeringFile(checkout, "fake-hold");
  writeFileSync(hold, "");
  let ready = true;
  const { worktrees } = service({
    checkout: () => (ready ? checkout : undefined),
  });
  const created = worktrees.create({
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
  const saved = path.join(dir, "user-data", "worktrees.json");
  mkdirSync(path.dirname(saved), { recursive: true });
  writeFileSync(saved, "not json");
  let ready = true;
  const { worktrees } = service({
    checkout: () => (ready ? checkout : undefined),
  });
  const created = await worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(!created.ok && created.error.message).toBe(
    "Alliance agent created fix-it, but couldn't save it as a worktree it created.",
  );
  expect(started).toEqual([]);
  expect(worktrees.current().worktrees).toContainEqual(
    expect.objectContaining({
      key: "new:c1",
      state: expect.objectContaining({
        status: WorktreeStatus.CreateFailed,
        leftover: expect.stringContaining("fix-it was created."),
      }),
    }),
  );

  ready = false;
  expect((await worktrees.retry("new:c1")).ok).toBe(false);
  expect(worktrees.current().worktrees[0]?.state).toMatchObject({
    leftover: expect.stringContaining("fix-it was created."),
  });

  ready = true;
  rmSync(saved);
  const retrying = worktrees.retry("new:c1");
  expect(worktrees.current().worktrees[0]?.state).toEqual({
    status: WorktreeStatus.Creating,
    stage: CreationStage.StartingAgent,
  });
  const retried = await retrying;
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it");
  const args = steeringFile(checkout, "fake-new-worktree-args");
  expect(readFileSync(args, "utf8").trim().split("\n")).toHaveLength(1);
  expect(
    worktrees.current().worktrees.map((t) => [t.title, t.createdByApp]),
  ).toEqual([["Fix it", true]]);
});

test("a made creation whose worktree is gone by Try again makes another rather than staying stuck", async () => {
  const saved = path.join(dir, "user-data", "worktrees.json");
  mkdirSync(path.dirname(saved), { recursive: true });
  writeFileSync(saved, "not json");
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(created.ok).toBe(false);
  rmSync(saved);
  const folder = path.join(dir, "workspaces", "alliance-fix-it");
  git(checkout, "worktree", "remove", "--force", folder);

  expect((await worktrees.retry("new:c1")).ok).toBe(false);
  expect(worktrees.current().worktrees[0]?.state).toMatchObject({
    status: WorktreeStatus.CreateFailed,
    made: false,
    leftover: undefined,
  });
  const retried = await worktrees.retry("new:c1");
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it-2");
});

test("retrying a name the script refused before creating anything tries another", async () => {
  const blocking = path.join(dir, "workspaces", "alliance-fix-it");
  mkdirSync(blocking, { recursive: true });
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  expect(!created.ok && created.error.details).toContain("already exists");
  const { worktrees: _, ...beforeRetry } = worktrees.current();
  const retrying = worktrees.retry("new:c1");
  expect(worktrees.current()).toEqual({
    ...beforeRetry,
    worktrees: [
      {
        key: "new:c1",
        title: "Fix it",
        createdByApp: true,
        archived: false,
        state: {
          status: WorktreeStatus.Creating,
          stage: CreationStage.Downloading,
        },
      },
    ],
  });
  const retried = await retrying;
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it-2");
});

test("two creations of the same request at once get different names", async () => {
  const { worktrees } = service();
  const created = await Promise.all(
    ["c1", "c2"].map((creationId) =>
      worktrees.create({
        creationId,
        request: "Fix it",
        agent: AgentKind.Claude,
      }),
    ),
  );
  expect(
    created.map((c) => c.ok && path.basename(c.value.folder)).sort(),
  ).toEqual(["alliance-fix-it", "alliance-fix-it-2"]);
});

test("dismissing a failed creation shows what it left behind as a worktree of its own", async () => {
  writeFileSync(steeringFile(checkout, "fake-fail"), "");
  const { worktrees } = service();
  await worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  worktrees.dismiss("new:c1");
  expect(worktrees.current().worktrees).toEqual([
    expect.objectContaining({
      key: "id-fix-it",
      title: "Fix it",
      createdByApp: true,
      state: { status: WorktreeStatus.NotFinished },
    }),
  ]);
});

test("a failed download creates nothing", async () => {
  rmSync(source, { recursive: true, force: true });
  const { worktrees } = service();
  const created = await worktrees.create({
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
  expect(worktrees.current().worktrees[0]?.state).toMatchObject({
    status: WorktreeStatus.CreateFailed,
    leftover: undefined,
  });
});

test("closing stops a creation in progress and waits for it", async () => {
  writeFileSync(steeringFile(checkout, "fake-hold"), "");
  const { worktrees } = service();
  const created = worktrees.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  await worktrees.close();
  expect((await created).ok).toBe(false);
  expect(started).toEqual([]);
  expect(readFileSync(args, "utf8")).toStartWith("fix-it --from ");
});
