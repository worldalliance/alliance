import { R } from "@alliance/common/result";
import { randomUUID } from "node:crypto";
import { checkStoredFormulas } from "../scripts/lib/stored-formula-problems";
import { FormulaVersion } from "../src/formulas/entities/formula-version.entity";
import { Formula } from "../src/formulas/entities/formula.entity";
import { FormulasModule } from "../src/formulas/formulas.module";
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
    await ctx.dataSource.getRepository(FormulaVersion).deleteAll();
    await ctx.dataSource.getRepository(Formula).deleteAll();
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
    expect(await check()).toEqual(R.success(1));
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
});
