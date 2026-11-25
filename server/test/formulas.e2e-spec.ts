import { randomUUID } from "node:crypto";
import request from "supertest";
import { lockUntilCommit } from "../src/datasources/advisory-lock";
import { FormulaVersion } from "../src/formulas/entities/formula-version.entity";
import { Formula } from "../src/formulas/entities/formula.entity";
import { FORMULAS_LOCK } from "../src/formulas/formula-store";
import { FormulasModule } from "../src/formulas/formulas.module";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

type Edit = {
  id: string;
  baseVersionId: number | null;
  name: string;
  text: string;
  notes: string | null;
};
type Listed = {
  id: string;
  name: string;
  text: string;
  notes: string | null;
  versionId: number;
  reads: string[];
};

describe("Formulas (e2e)", () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();
  const save = (
    edits: Edit[],
    deletions: { id: string; baseVersionId: number }[] = [],
    token = ctx.adminAccessToken,
  ) =>
    request(server())
      .post("/formulas/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ edits, deletions });
  const list = async (): Promise<Listed[]> =>
    (
      await request(server())
        .get("/formulas")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200)
    ).body;
  const versions = async (id: string) =>
    (
      await request(server())
        .get(`/formulas/${id}/versions`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200)
    ).body;
  const fresh = (name: string, text: string): Edit => ({
    id: randomUUID(),
    baseVersionId: null,
    name,
    text,
    notes: null,
  });
  const edit = (formula: Listed, change: Partial<Edit>): Edit => ({
    id: formula.id,
    baseVersionId: formula.versionId,
    name: formula.name,
    text: formula.text,
    notes: formula.notes,
    ...change,
  });
  const byName = async (name: string) => {
    const found = (await list()).find((formula) => formula.name === name);
    if (found === undefined) throw new Error(`no formula ${name}`);
    return found;
  };

  /** `base` = 2 and `doubled` = base * 2, saved together. */
  const seed = async () => {
    const base = fresh("base", "2");
    const doubled = fresh("doubled", "base * 2");
    await save([base, doubled]).expect(200, { problems: [] });
    return { base: await byName("base"), doubled: await byName("doubled") };
  };

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

  it("is for admins only", async () => {
    for (const token of ["", ctx.accessToken]) {
      await request(server())
        .get("/formulas")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
      await save([fresh("x", "1")], [], token).expect(401);
    }
  });

  it("saves formulas that read each other in one save, with who saved them", async () => {
    const { base, doubled } = await seed();
    expect(doubled).toMatchObject({ text: "base * 2", reads: [base.id] });
    expect(base).toMatchObject({ text: "2", reads: [] });
    expect(await versions(doubled.id)).toEqual([
      expect.objectContaining({
        name: "doubled",
        text: "base * 2",
        savedByName: expect.any(String),
      }),
    ]);
  });

  it("refuses a save that breaks a formula reading it, and writes nothing", async () => {
    const { base, doubled } = await seed();
    const { body } = await save([edit(base, { text: '"two"' })]).expect(200);
    expect(body.problems).toEqual([
      {
        kind: "named",
        id: doubled.id,
        text: "base * 2",
        diagnostics: [expect.objectContaining({ message: expect.any(String) })],
      },
    ]);
    expect(await byName("base")).toEqual(base);
    expect(await versions(base.id)).toHaveLength(1);
  });

  it("saves a change together with the formula it would break, fixed", async () => {
    const { base, doubled } = await seed();
    await save([
      edit(base, { text: '"two"' }),
      edit(doubled, { text: "base + base" }),
    ]).expect(200, { problems: [] });
    expect((await byName("doubled")).text).toBe("base + base");
    expect(await versions(base.id)).toHaveLength(2);
  });

  it("refuses deleting a formula another reads, then deletes both together", async () => {
    const { base, doubled } = await seed();
    const refused = await save(
      [],
      [{ id: base.id, baseVersionId: base.versionId }],
    ).expect(200);
    expect(refused.body.problems).toEqual([
      {
        kind: "named",
        id: doubled.id,
        text: "base * 2",
        diagnostics: [
          {
            message: "This uses a formula that no longer exists.",
            start: 0,
            end: 8,
          },
        ],
      },
    ]);
    await save(
      [],
      [
        { id: base.id, baseVersionId: base.versionId },
        { id: doubled.id, baseVersionId: doubled.versionId },
      ],
    ).expect(200, { problems: [] });
    expect(await list()).toEqual([]);
    expect(await versions(doubled.id)).toEqual([
      expect.objectContaining({ text: "base * 2" }),
    ]);
  });

  it("lets a deleted formula's name be taken in the same save", async () => {
    const lone = fresh("lone", "1");
    await save([lone]).expect(200, { problems: [] });
    const saved = await byName("lone");
    await save(
      [fresh("lone", "2")],
      [{ id: saved.id, baseVersionId: saved.versionId }],
    ).expect(200, { problems: [] });
    expect((await list()).map(({ name, text }) => ({ name, text }))).toEqual([
      { name: "lone", text: "2" },
    ]);
  });

  it("swaps two formulas' names in one save and reprints their readers", async () => {
    const { base, doubled } = await seed();
    await save([
      edit(base, { name: "doubled" }),
      edit(doubled, { name: "base", text: "doubled * 2" }),
    ]).expect(200, { problems: [] });
    expect(
      (await list()).map(({ id, name, text }) => ({ id, name, text })),
    ).toEqual([
      { id: doubled.id, name: "base", text: "doubled * 2" },
      { id: base.id, name: "doubled", text: "2" },
    ]);
  });

  it("adds no version for a save that changes nothing", async () => {
    const { base } = await seed();
    await save([edit(base, {})]).expect(200, { problems: [] });
    await save([edit(base, { notes: "  " })]).expect(200, { problems: [] });
    expect(await versions(base.id)).toHaveLength(1);
    await save([edit(base, { notes: "Why it is 2" })]).expect(200, {
      problems: [],
    });
    expect(await versions(base.id)).toHaveLength(2);
    expect((await byName("base")).notes).toBe("Why it is 2");
  });

  it("refuses a name the language can't use", async () => {
    const bad = fresh("1st", "1");
    const { body } = await save([bad]).expect(200);
    expect(body.problems).toEqual([
      expect.objectContaining({ kind: "name", id: bad.id }),
    ]);
    expect(await list()).toEqual([]);
  });

  it("refuses an edit of a version that is no longer current", async () => {
    const { base } = await seed();
    await save([edit(base, { text: "3" })]).expect(200, { problems: [] });
    const stale = await save([edit(base, { name: "renamed" })]).expect(409);
    expect(stale.body.message).toBe(
      "`base` was changed since you opened it. Reload to see the latest version.",
    );
    await save([{ ...fresh("again", "1"), id: base.id }]).expect(409);
  });

  it("refuses a new formula whose id names an existing one in another case", async () => {
    const { base } = await seed();
    const upper = { ...fresh("other", '"two"'), id: base.id.toUpperCase() };
    await save([upper]).expect(409);
    const after = await byName("base");
    expect(after).toMatchObject({ text: "2", versionId: base.versionId });
  });

  it("refuses a deletion of an old version, and any change to a deleted formula", async () => {
    const { doubled } = await seed();
    await save([edit(doubled, { text: "base * 3" })]).expect(200, {
      problems: [],
    });
    const staleDeletion = await save(
      [],
      [{ id: doubled.id, baseVersionId: doubled.versionId }],
    ).expect(409);
    expect(staleDeletion.body.message).toBe(
      "`doubled` was changed since you opened it. Reload to see the latest version.",
    );

    const current = await byName("doubled");
    await save(
      [],
      [{ id: current.id, baseVersionId: current.versionId }],
    ).expect(200, { problems: [] });
    const editDeleted = await save([edit(current, { text: "1" })]).expect(409);
    expect(editDeleted.body.message).toBe(
      "`doubled` was deleted since you opened it. Reload to see the formulas as they are now.",
    );
    const deleteAgain = await save(
      [],
      [{ id: current.id, baseVersionId: current.versionId }],
    ).expect(409);
    expect(deleteAgain.body.message).toBe(
      "`doubled` was deleted since you opened it. Reload to see the formulas as they are now.",
    );
  });

  it("waits for the save in progress, so each checks what the last one wrote", async () => {
    const { base } = await seed();
    const holder = ctx.dataSource.createQueryRunner();
    await holder.startTransaction();
    await lockUntilCommit(holder.manager, FORMULAS_LOCK);
    let settled = false;
    const pending = save([edit(base, { text: "3" })]).then((response) => {
      settled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(settled).toBe(false);
    await holder.commitTransaction();
    await holder.release();
    expect((await pending).status).toBe(200);
  });

  it("answers 404 for the history of a formula that doesn't exist", async () => {
    await request(server())
      .get(`/formulas/${randomUUID()}/versions`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
  });

  it("refuses a formula listed twice", async () => {
    const twice = fresh("twice", "1");
    await save([twice, twice]).expect(400);
  });

  it("refuses notes holding a character the database can't store", async () => {
    await save([{ ...fresh("noted", "1"), notes: "a\u0000b" }]).expect(400);
    expect(await list()).toEqual([]);
  });
});
