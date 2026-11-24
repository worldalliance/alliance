import { randomUUID } from "node:crypto";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { FormulasModule } from "../src/formulas/formulas.module";
import { MemberListsModule } from "../src/member-lists/member-lists.module";
import { PartFallback } from "../src/suite-partitions/partition-parts";
import { SuitePartitionsModule } from "../src/suite-partitions/suite-partitions.module";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";
import {
  part,
  required,
  suitePartitionFixtures,
} from "./suite-partition-fixtures";

describe("Partition parts as formula dependents (e2e)", () => {
  let ctx: TestContext;
  let fx: ReturnType<typeof suitePartitionFixtures>;

  beforeAll(async () => {
    ctx = await createTestApp([
      FormulasModule,
      MemberListsModule,
      SuitePartitionsModule,
    ]);
    fx = suitePartitionFixtures(ctx);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("refuses a formula save that leaves a draft partition's part undecided, and takes its fix", async () => {
    const id = randomUUID();
    const name = `gate${Date.now()}`;
    await fx
      .saveFormulas({
        edits: [{ id, baseVersionId: null, name, text: "true", notes: null }],
      })
      .expect(200);
    const { suite, partition } = await fx.createPartition({
      actionNames: ["Call"],
      parts: ([call]) => [part("Gated", name, [required(call.id)])],
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
        partition: {
          suiteId: suite.id,
          suiteName: suite.name,
          versionId: partition.versionId,
          partId: partition.parts[0].id,
          partName: "Gated",
          fallback: null,
        },
      }),
    ]);

    const fixed = await fx
      .saveFormulas({
        edits: [edit],
        partFixes: [
          {
            suiteId: suite.id,
            baseVersionId: partition.versionId,
            partId: partition.parts[0].id,
            text: name,
            fallback: PartFallback.Continue,
          },
        ],
      })
      .expect(200);
    expect(fixed.body.problems).toEqual([]);
    const after = await fx.get(suite.id);
    expect(after.versionId).toBeGreaterThan(partition.versionId);
    expect(after.parts[0].fallback).toBe(PartFallback.Continue);
  });

  it("refuses deleting a list a draft partition reads", async () => {
    const list = await fx.createList(`Read list ${randomUUID()}`, []);
    const { suite } = await fx.createPartition({
      actionNames: ["Call"],
      parts: ([call]) => [
        part("On it", `isOnList("${list.name}")`, [required(call.id)]),
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
        partition: expect.objectContaining({
          suiteId: suite.id,
          partName: "On it",
        }),
      }),
    ]);
  });

  it("refuses a fix that is stale, of a part with no condition, repeated, or that doesn't check, and skips one that changes nothing, a needless fallback included", async () => {
    const { suite, partition } = await fx.createPartition({
      actionNames: ["Call"],
      parts: ([call]) => [part("Anyone", "true", [required(call.id)])],
    });
    const fix = (overrides: Record<string, unknown>) => ({
      suiteId: suite.id,
      baseVersionId: partition.versionId,
      partId: partition.parts[0].id,
      text: "true",
      fallback: null,
      ...overrides,
    });
    const save = (partFixes: Record<string, unknown>[]) =>
      fx.saveFormulas({ partFixes });

    await save([fix({ baseVersionId: partition.versionId - 1 })]).expect(409);
    await save([fix({ partId: partition.parts[1].id })]).expect(400);
    await save([fix({}), fix({ text: "false" })]).expect(400);
    const failing = await save([fix({ text: "garbage ((" })]).expect(200);
    expect(failing.body.problems).toEqual([
      expect.objectContaining({
        kind: "dependent",
        partition: expect.objectContaining({ partName: "Anyone" }),
      }),
    ]);
    expect((await save([fix({})]).expect(200)).body.problems).toEqual([]);
    expect(
      (await save([fix({ fallback: PartFallback.Continue })]).expect(200)).body
        .problems,
    ).toEqual([]);
    expect((await fx.get(suite.id)).versionId).toBe(partition.versionId);
  });

  it.each([
    [
      "leaves the partition of a suite that has gone live unchecked",
      -60_000,
      0,
    ],
    ["checks the partition of a scheduled suite", 86_400_000, 1],
  ])("%s", async (_, memberActionIn, problems) => {
    const id = randomUUID();
    const name = `live${Date.now()}`;
    await fx
      .saveFormulas({
        edits: [{ id, baseVersionId: null, name, text: "true", notes: null }],
      })
      .expect(200);
    const { actions } = await fx.createPartition({
      actionNames: ["Call"],
      parts: ([call]) => [part("Gated", name, [required(call.id)])],
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
