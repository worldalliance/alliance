import { R } from "@alliance/common/result";
import { randomUUID } from "node:crypto";
import { checkStoredFormulas } from "../scripts/lib/stored-formula-problems";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { FormulaVersion } from "../src/formulas/entities/formula-version.entity";
import { Formula } from "../src/formulas/entities/formula.entity";
import { FormulasModule } from "../src/formulas/formulas.module";
import { MemberListVersion } from "../src/member-lists/entities/member-list-version.entity";
import { MemberList } from "../src/member-lists/entities/member-list.entity";
import { SuitePartitionVersion } from "../src/suite-partitions/entities/suite-partition-version.entity";
import { SuitePartition } from "../src/suite-partitions/entities/suite-partition.entity";
import { EVERYONE_ELSE } from "../src/suite-partitions/partition-parts";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

describe("Stored formula re-check (e2e)", () => {
  let ctx: TestContext;
  const store = async (params: {
    name: string;
    tree: Record<string, unknown>;
    deleted?: boolean;
  }) => {
    const id = randomUUID();
    await ctx.dataSource.getRepository(Formula).insert({
      id,
      name: params.name,
      deletedAt: params.deleted === true ? new Date() : null,
    });
    await ctx.dataSource.getRepository(FormulaVersion).insert({
      formulaId: id,
      name: params.name,
      tree: params.tree,
      notes: null,
      savedById: null,
    });
    return id;
  };
  const check = () => checkStoredFormulas(ctx.dataSource.manager);

  beforeAll(async () => {
    ctx = await createTestApp([FormulasModule]);
  }, 50000);
  beforeEach(async () => {
    await ctx.dataSource.getRepository(SuitePartitionVersion).deleteAll();
    await ctx.dataSource.getRepository(SuitePartition).deleteAll();
    await ctx.dataSource.getRepository(FormulaVersion).deleteAll();
    await ctx.dataSource.getRepository(Formula).deleteAll();
    await ctx.dataSource.getRepository(MemberListVersion).deleteAll();
    await ctx.dataSource.getRepository(MemberList).deleteAll();
  });
  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("passes formulas that still check, skipping deleted ones", async () => {
    await store({ name: "two", tree: { kind: "literal", value: 2 } });
    await store({
      name: "gone",
      tree: { kind: "input", id: "missing" },
      deleted: true,
    });
    expect(await check()).toEqual(R.success({ formulas: 1, parts: 0 }));
  });

  it("checks formulas against the member lists stored now", async () => {
    const list = await ctx.dataSource
      .getRepository(MemberList)
      .save({ name: "Volunteers" });
    await ctx.dataSource
      .getRepository(MemberListVersion)
      .insert({ listId: list.id, savedById: null });
    await store({ name: "onList", tree: { kind: "onList", listId: list.id } });
    expect(await check()).toEqual(R.success({ formulas: 1, parts: 0 }));
    await ctx.dataSource.getRepository(MemberList).softDelete(list.id);
    const result = await check();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("This uses a list that no longer exists.");
    }
  });

  it("names each formula the release breaks, and none that pass", async () => {
    await store({ name: "two", tree: { kind: "literal", value: 2 } });
    const broken = await store({
      name: "readsMissing",
      tree: { kind: "input", id: "missing" },
    });
    const result = await check();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(`Formula \`readsMissing\` (${broken})`);
      expect(result.error).toContain(
        "This uses something that no longer exists.",
      );
      expect(result.error).not.toContain("`two`");
    }
  });

  it("names each formula whose stored tree the release can't read", async () => {
    await store({ name: "two", tree: { kind: "literal", value: 2 } });
    const retired = await store({ name: "retired", tree: { kind: "retired" } });
    const result = await check();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        "This release can't read these stored formulas.",
      );
      expect(result.error).toContain(`Formula \`retired\` (${retired}):`);
      expect(result.error).not.toContain("`two`");
    }
  });

  it("names a formula whose stored name the release refuses", async () => {
    const id = await store({
      name: "__internal",
      tree: { kind: "literal", value: 2 },
    });
    const result = await check();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        `Formula \`__internal\` (${id}): A name can't start with \`__\`.`,
      );
    }
  });

  it("names a draft partition's part that reads a list deleted since", async () => {
    const list = await ctx.dataSource
      .getRepository(MemberList)
      .save({ name: "Volunteers" });
    await ctx.dataSource
      .getRepository(MemberListVersion)
      .insert({ listId: list.id, savedById: null });
    const suite = await ctx.dataSource
      .getRepository(ActionSuite)
      .save({ name: "Climate" });
    await ctx.dataSource
      .getRepository(SuitePartition)
      .insert({ suiteId: suite.id, createdById: null });
    const part = (name: string, condition: Record<string, unknown> | null) => ({
      id: randomUUID(),
      name,
      condition,
      fallback: null,
      noRequiredWorkTick: null,
      cells: [],
    });
    await ctx.dataSource.getRepository(SuitePartitionVersion).insert({
      suiteId: suite.id,
      parts: [
        part("On it", { kind: "onList", listId: list.id }),
        part(EVERYONE_ELSE, null),
      ],
      savedById: null,
    });
    expect(await check()).toEqual(R.success({ formulas: 0, parts: 1 }));
    await ctx.dataSource.getRepository(MemberList).softDelete(list.id);
    const result = await check();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        `Part "On it" of suite "Climate" (${suite.id})`,
      );
    }
  });

  it("stops on a draft partition version the release can't parse", async () => {
    const suite = await ctx.dataSource
      .getRepository(ActionSuite)
      .save({ name: "Climate" });
    await ctx.dataSource
      .getRepository(SuitePartition)
      .insert({ suiteId: suite.id, createdById: null });
    const { identifiers } = await ctx.dataSource
      .getRepository(SuitePartitionVersion)
      .insert({
        suiteId: suite.id,
        parts: [{ unknown: true }],
        savedById: null,
      });
    await expect(check()).rejects.toThrow(
      `partition version ${identifiers[0].id} doesn't parse`,
    );
  });
});
