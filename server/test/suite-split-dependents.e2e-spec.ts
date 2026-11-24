import { randomUUID } from "node:crypto";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { FormulasModule } from "../src/formulas/formulas.module";
import { MemberListsModule } from "../src/member-lists/member-lists.module";
import { GroupFallback } from "../src/suite-splits/split-groups";
import { SuiteSplitsModule } from "../src/suite-splits/suite-splits.module";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";
import { group, required, suiteSplitFixtures } from "./suite-split-fixtures";

describe("Split groups as formula dependents (e2e)", () => {
  let ctx: TestContext;
  let fx: ReturnType<typeof suiteSplitFixtures>;

  beforeAll(async () => {
    ctx = await createTestApp([
      FormulasModule,
      MemberListsModule,
      SuiteSplitsModule,
    ]);
    fx = suiteSplitFixtures(ctx);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("refuses a formula save that leaves a draft split's group undecided, and takes its fix", async () => {
    const id = randomUUID();
    const name = `gate${Date.now()}`;
    await fx
      .saveFormulas({
        edits: [{ id, baseVersionId: null, name, text: "true", notes: null }],
      })
      .expect(200);
    const { suite, split } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [group("Gated", name, [required(call.id)])],
    });
    const list = await fx.createList(`Gate list ${randomUUID()}`, []);
    const edit = {
      id,
      baseVersionId: await fx.formulaVersion(id),
      name,
      text: `isOnList("${list.name}") ? true : null`,
      notes: null,
    };

    const refused = await fx.saveFormulas({ edits: [edit] }).expect(200);
    expect(refused.body.problems).toEqual([
      expect.objectContaining({
        kind: "dependent",
        split: {
          suiteId: suite.id,
          suiteName: suite.name,
          versionId: split.versionId,
          groupId: split.groups[0].id,
          groupName: "Gated",
          fallback: null,
        },
      }),
    ]);

    const fixed = await fx
      .saveFormulas({
        edits: [edit],
        groupFixes: [
          {
            suiteId: suite.id,
            baseVersionId: split.versionId,
            groupId: split.groups[0].id,
            text: name,
            fallback: GroupFallback.Continue,
          },
        ],
      })
      .expect(200);
    expect(fixed.body.problems).toEqual([]);
    const after = await fx.get(suite.id);
    expect(after.versionId).toBeGreaterThan(split.versionId);
    expect(after.groups[0].fallback).toBe(GroupFallback.Continue);
  });

  it("refuses deleting a list a draft split reads", async () => {
    const list = await fx.createList(`Read list ${randomUUID()}`, []);
    const { suite } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [
        group("On it", `isOnList("${list.name}")`, [required(call.id)]),
      ],
    });
    const refused = await fx
      .saveFormulas({
        deletedLists: [{ id: list.id, baseVersionId: list.versionId }],
      })
      .expect(200);
    expect(refused.body.problems).toEqual([
      expect.objectContaining({
        kind: "dependent",
        split: expect.objectContaining({
          suiteId: suite.id,
          groupName: "On it",
        }),
      }),
    ]);
  });

  it("refuses a fix that is stale, of a group with no condition, repeated, or that doesn't check, and skips one that changes nothing, a needless fallback included", async () => {
    const { suite, split } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [group("Anyone", "true", [required(call.id)])],
    });
    const fix = (overrides: Record<string, unknown>) => ({
      suiteId: suite.id,
      baseVersionId: split.versionId,
      groupId: split.groups[0].id,
      text: "true",
      fallback: null,
      ...overrides,
    });
    const save = (groupFixes: Record<string, unknown>[]) =>
      fx.saveFormulas({ groupFixes });

    await save([fix({ baseVersionId: split.versionId - 1 })]).expect(409);
    await save([fix({ groupId: split.groups[1].id })]).expect(400);
    await save([fix({}), fix({ text: "false" })]).expect(400);
    const failing = await save([fix({ text: "garbage ((" })]).expect(200);
    expect(failing.body.problems).toEqual([
      expect.objectContaining({
        kind: "dependent",
        split: expect.objectContaining({ groupName: "Anyone" }),
      }),
    ]);
    expect((await save([fix({})]).expect(200)).body.problems).toEqual([]);
    expect(
      (await save([fix({ fallback: GroupFallback.Continue })]).expect(200)).body
        .problems,
    ).toEqual([]);
    expect((await fx.get(suite.id)).versionId).toBe(split.versionId);
  });

  it.each([
    ["leaves the split of a suite that has gone live unchecked", -60_000, 0],
    ["checks the split of a scheduled suite", 86_400_000, 1],
  ])("%s", async (_, memberActionIn, problems) => {
    const id = randomUUID();
    const name = `live${Date.now()}`;
    await fx
      .saveFormulas({
        edits: [{ id, baseVersionId: null, name, text: "true", notes: null }],
      })
      .expect(200);
    const { actions } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [group("Gated", name, [required(call.id)])],
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Members act",
      description: "Member phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() + memberActionIn),
      action: { id: actions[0].id },
    });
    const saved = await fx
      .saveFormulas({
        edits: [
          {
            id,
            baseVersionId: await fx.formulaVersion(id),
            name,
            text: "null",
            notes: null,
          },
        ],
      })
      .expect(200);
    expect(saved.body.problems).toHaveLength(problems);
  });
});
