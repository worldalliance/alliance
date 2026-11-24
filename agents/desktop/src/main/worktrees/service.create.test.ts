import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { CreationStage, WorktreeStatus } from "../../shared/worktree";
import { commitFile, git } from "../repository/testing/fixture";
import { steeringFile } from "./testing/fixture";
import {
  checkout,
  dir,
  service,
  setUp,
  source,
  tearDown,
} from "./testing/service-fixture";

beforeEach(setUp);
afterEach(tearDown);

test("creates a worktree named after what was typed from the latest main, reports each stage, and records which worktree its creation became", async () => {
  const latest = commitFile({
    folder: source,
    file: "later.txt",
    message: "Later",
  });
  const { worktrees, states } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix the signup copy",
  });
  const folder = path.join(dir, "workspaces", "alliance-fix-the-signup-copy");
  expect(created).toEqual({
    ok: true,
    value: { key: "id-fix-the-signup-copy", folder },
  });
  expect(git(folder, "rev-parse", "HEAD")).toBe(latest);
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
  ]);
  expect(worktrees.current().worktrees).toEqual([
    expect.objectContaining({
      key: "id-fix-the-signup-copy",
      name: "fix-the-signup-copy",
    }),
  ]);
  expect(worktrees.current().created).toEqual({
    "new:c1": "id-fix-the-signup-copy",
  });
});

test("refuses a name with no letter from a to z or digit without starting a creation", async () => {
  const { worktrees } = service();
  const created = await worktrees.create({ creationId: "c1", name: "¿¡…!?" });
  expect(!created.ok && created.error.message).toBe(
    "A worktree name needs a letter from a to z or a digit.",
  );
  expect(worktrees.current().worktrees).toEqual([]);
  expect(existsSync(steeringFile(checkout, "fake-new-worktree-args"))).toBe(
    false,
  );
});

test("names a worktree so it reuses no branch, even one a tag shares a name with, or branch folder, since the script would check an existing one out and git can't create the other", async () => {
  git(checkout, "branch", "fix-it");
  git(checkout, "branch", "fix-it-2/login");
  git(checkout, "branch", "fix-it-3");
  git(checkout, "tag", "fix-it-3");
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
  });
  expect(created.ok && created.value.folder).toEndWith("alliance-fix-it-4");
});

test("a failed creation stays listed with what was typed and its leftover until retried under a new name", async () => {
  const fail = steeringFile(checkout, "fake-fail");
  writeFileSync(fail, "");
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
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
      typed: "Fix it",
      leftover: expect.stringContaining(
        `Part of it was created: ${path.join(dir, "workspaces", "alliance-fix-it")}.`,
      ),
    },
  });

  rmSync(fail);
  const retried = await worktrees.retry("new:c1");
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it-2");
  expect(
    worktrees.current().worktrees.map((t) => [t.name, t.state.status]),
  ).toEqual([
    ["fix-it", WorktreeStatus.NotFinished],
    ["fix-it-2", WorktreeStatus.Ready],
  ]);
});

test("a failed creation whose leftover couldn't be listed says so rather than that nothing was created", async () => {
  writeFileSync(steeringFile(checkout, "fake-fail"), "");
  const hold = steeringFile(checkout, "fake-hold");
  writeFileSync(hold, "");
  const { worktrees } = service();
  const created = worktrees.create({
    creationId: "c1",
    name: "Fix it",
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
    name: "Fix it",
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
    worktrees.current().worktrees.map((t) => [t.name, t.state.status]),
  ).toEqual([["fix-it", WorktreeStatus.Ready]]);
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
    name: "Fix it",
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  ready = false;
  rmSync(hold);
  const result = await created;
  expect(result.ok && result.value.folder).toEndWith("alliance-fix-it");
  expect(readFileSync(args, "utf8").trim().split("\n")).toHaveLength(1);
});

/** Creates fix-it with its listing failing once the script has run, so the creation fails having made it. */
async function madeButUnlisted(
  worktrees: ReturnType<typeof service>["worktrees"],
) {
  const hold = steeringFile(checkout, "fake-hold");
  const listFails = steeringFile(checkout, "fake-list-fails");
  writeFileSync(hold, "");
  const created = worktrees.create({ creationId: "c1", name: "Fix it" });
  while (!existsSync(steeringFile(checkout, "fake-new-worktree-args")))
    await Bun.sleep(10);
  writeFileSync(listFails, "");
  rmSync(hold);
  expect((await created).ok).toBe(false);
  rmSync(listFails);
}

test("a made creation keeps saying what it made while the repository isn't ready, and Try again finds it", async () => {
  let ready = true;
  const { worktrees } = service({
    checkout: () => (ready ? checkout : undefined),
  });
  await madeButUnlisted(worktrees);

  ready = false;
  expect((await worktrees.retry("new:c1")).ok).toBe(false);
  expect(worktrees.current().worktrees[0]?.state).toMatchObject({
    leftover: expect.stringContaining("fix-it was created."),
  });

  ready = true;
  const retrying = worktrees.retry("new:c1");
  expect(worktrees.current().worktrees[0]).toMatchObject({
    name: "fix-it",
    state: { status: WorktreeStatus.Creating, stage: CreationStage.Finding },
  });
  const retried = await retrying;
  expect(retried.ok && retried.value.folder).toEndWith("alliance-fix-it");
  const args = steeringFile(checkout, "fake-new-worktree-args");
  expect(readFileSync(args, "utf8").trim().split("\n")).toHaveLength(1);
});

test("a made creation whose worktree is gone by Try again makes another rather than staying stuck", async () => {
  const { worktrees } = service();
  await madeButUnlisted(worktrees);
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
    name: "Fix it",
  });
  expect(!created.ok && created.error.details).toContain("already exists");
  const { worktrees: _, ...beforeRetry } = worktrees.current();
  const retrying = worktrees.retry("new:c1");
  expect(worktrees.current()).toEqual({
    ...beforeRetry,
    worktrees: [
      {
        key: "new:c1",
        name: "fix-it",
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

test("two creations of the same name at once get different names", async () => {
  const { worktrees } = service();
  const created = await Promise.all(
    ["c1", "c2"].map((creationId) =>
      worktrees.create({
        creationId,
        name: "Fix it",
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
    name: "Fix it",
  });
  worktrees.dismiss("new:c1");
  expect(worktrees.current().worktrees).toEqual([
    expect.objectContaining({
      key: "id-fix-it",
      name: "fix-it",
      state: { status: WorktreeStatus.NotFinished },
    }),
  ]);
});

test("a failed download creates nothing", async () => {
  rmSync(source, { recursive: true, force: true });
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
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
    name: "Fix it",
  });
  const args = steeringFile(checkout, "fake-new-worktree-args");
  while (!existsSync(args)) await Bun.sleep(10);
  await worktrees.close();
  expect((await created).ok).toBe(false);
  expect(readFileSync(args, "utf8")).toStartWith("fix-it --from ");
});
