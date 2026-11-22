import { randomUUID } from "node:crypto";
import request from "supertest";
import { softDeleteCascade } from "../src/datasources/soft-delete";
import { FormulaVersion } from "../src/formulas/entities/formula-version.entity";
import { Formula } from "../src/formulas/entities/formula.entity";
import { FormulasModule } from "../src/formulas/formulas.module";
import { MemberListMember } from "../src/member-lists/entities/member-list-member.entity";
import { MemberListVersion } from "../src/member-lists/entities/member-list-version.entity";
import { MemberList } from "../src/member-lists/entities/member-list.entity";
import { MemberListsModule } from "../src/member-lists/member-lists.module";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
  waitForLockWait,
} from "./e2e-test-utils";

type Listed = {
  id: string;
  name: string;
  versionId: number;
  userIds: number[];
};
type FormulaListed = {
  id: string;
  name: string;
  text: string;
  versionId: number;
};

describe("Member lists (e2e)", () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();
  const auth = (token = ctx.adminAccessToken) => `Bearer ${token}`;
  const create = (body: { name: string; userIds: number[] }) =>
    request(server())
      .post("/member-lists")
      .set("Authorization", auth())
      .send(body);
  const update = (
    list: Listed,
    change: Partial<{ name: string; userIds: number[]; baseVersionId: number }>,
  ) =>
    request(server())
      .put(`/member-lists/${list.id}`)
      .set("Authorization", auth())
      .send({
        name: list.name,
        userIds: list.userIds,
        baseVersionId: list.versionId,
        baseName: list.name,
        ...change,
      });
  const lists = async (): Promise<Listed[]> =>
    (
      await request(server())
        .get("/member-lists")
        .set("Authorization", auth())
        .expect(200)
    ).body;
  const formulas = async (): Promise<FormulaListed[]> =>
    (
      await request(server())
        .get("/formulas")
        .set("Authorization", auth())
        .expect(200)
    ).body;
  const saveFormulas = (body: {
    edits?: unknown[];
    deletedLists?: { id: string; baseVersionId: number }[];
  }) =>
    request(server())
      .post("/formulas/save")
      .set("Authorization", auth())
      .send({ edits: [], deletions: [], ...body });
  const newFormula = (name: string, text: string) => ({
    id: randomUUID(),
    baseVersionId: null,
    name,
    text,
    notes: null,
  });

  /** "Volunteers" holding the test user, and `onVolunteers` reading it. */
  const seed = async () => {
    const list: Listed = (
      await create({ name: "Volunteers", userIds: [ctx.testUserId] }).expect(
        201,
      )
    ).body;
    await saveFormulas({
      edits: [newFormula("onVolunteers", 'isOnList("Volunteers")')],
    }).expect(200, { problems: [] });
    const [formula] = await formulas();
    return { list, formula };
  };

  beforeAll(async () => {
    ctx = await createTestApp([FormulasModule, MemberListsModule]);
  }, 50000);
  beforeEach(async () => {
    await ctx.dataSource.getRepository(FormulaVersion).deleteAll();
    await ctx.dataSource.getRepository(Formula).deleteAll();
    await ctx.dataSource.getRepository(MemberListMember).deleteAll();
    await ctx.dataSource.getRepository(MemberListVersion).deleteAll();
    await ctx.dataSource.getRepository(MemberList).deleteAll();
  });
  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("is for admins only", async () => {
    for (const token of ["", ctx.accessToken]) {
      await request(server())
        .get("/member-lists")
        .set("Authorization", auth(token))
        .expect(401);
      await request(server())
        .post("/member-lists")
        .set("Authorization", auth(token))
        .send({ name: "x", userIds: [] })
        .expect(401);
    }
  });

  it("creates a list with its members, trimming the name", async () => {
    const created: Listed = (
      await create({
        name: "  Volunteers ",
        userIds: [ctx.testUserId, ctx.adminUserId],
      }).expect(201)
    ).body;
    expect(created).toMatchObject({ name: "Volunteers" });
    expect([...created.userIds].sort()).toEqual(
      [ctx.testUserId, ctx.adminUserId].sort(),
    );
    expect(await lists()).toEqual([created]);
  });

  it("refuses a taken name, an empty name and members that don't exist", async () => {
    await create({ name: "Volunteers", userIds: [] }).expect(201);
    const taken = await create({ name: "Volunteers", userIds: [] }).expect(400);
    expect(taken.body.message).toBe(
      "Another list has this name. Pick another name.",
    );
    await create({ name: "  ", userIds: [] }).expect(400);
    const missing = await create({ name: "Other", userIds: [999999] }).expect(
      400,
    );
    expect(missing.body.message).toBe("No member has this id: 999999.");
    const other: Listed = (
      await create({ name: "Other", userIds: [] }).expect(201)
    ).body;
    const renamed = await update(other, { name: "Volunteers" }).expect(400);
    expect(renamed.body.message).toBe(
      "Another list has this name. Pick another name.",
    );
    expect(await lists()).toHaveLength(2);
  });

  it("adds a version when the members change, and only then", async () => {
    const { list } = await seed();
    const renamed: Listed = (
      await update(list, { name: "Helpers" }).expect(200)
    ).body;
    expect(renamed).toMatchObject({
      name: "Helpers",
      versionId: list.versionId,
    });
    const changed: Listed = (
      await update(renamed, { userIds: [ctx.adminUserId] }).expect(200)
    ).body;
    expect(changed.versionId).toBeGreaterThan(list.versionId);
    expect(changed.userIds).toEqual([ctx.adminUserId]);
    const old = await ctx.dataSource
      .getRepository(MemberListMember)
      .findBy({ versionId: list.versionId });
    expect(old.map((member) => member.userId)).toEqual([ctx.testUserId]);
  });

  it("refuses a membership save based on an older version", async () => {
    const { list } = await seed();
    await update(list, { userIds: [] }).expect(200);
    const stale = await update(list, { userIds: [ctx.adminUserId] }).expect(
      409,
    );
    expect(stale.body.message).toBe(
      "This list changed since you opened it. Reload to see the changes.",
    );
  });

  it("refuses a save from a view opened before a rename", async () => {
    const { list } = await seed();
    await update(list, { name: "Helpers" }).expect(200);
    await update(list, { userIds: [ctx.adminUserId] }).expect(409);
    expect((await lists())[0].name).toBe("Helpers");
  });

  it("prints a formula with the list's current name after a rename", async () => {
    const { list } = await seed();
    await update(list, { name: 'Core "team"' }).expect(200);
    expect((await formulas())[0].text).toBe('isOnList("Core \\"team\\"")');
  });

  it("refuses deleting a list a formula reads, naming the formula", async () => {
    const { list, formula } = await seed();
    const refused = await saveFormulas({
      deletedLists: [{ id: list.id, baseVersionId: list.versionId }],
    }).expect(200);
    expect(refused.body.problems).toEqual([
      {
        kind: "named",
        id: formula.id,
        text: 'isOnList("Volunteers")',
        diagnostics: [
          {
            message: "This uses a list that no longer exists.",
            start: 0,
            end: 'isOnList("Volunteers")'.length,
          },
        ],
      },
    ]);
    expect(await lists()).toHaveLength(1);
  });

  it("deletes a list together with a fix to the formula reading it", async () => {
    const { list, formula } = await seed();
    await saveFormulas({
      edits: [
        {
          id: formula.id,
          baseVersionId: formula.versionId,
          name: formula.name,
          text: "false",
          notes: null,
        },
      ],
      deletedLists: [{ id: list.id, baseVersionId: list.versionId }],
    }).expect(200, { problems: [] });
    expect(await lists()).toEqual([]);
    const history = (
      await request(server())
        .get(`/formulas/${formula.id}/versions`)
        .set("Authorization", auth())
        .expect(200)
    ).body;
    expect(history.map((version: { text: string }) => version.text)).toEqual([
      "false",
      'isOnList("Volunteers")',
    ]);
    // The name is free again.
    await create({ name: "Volunteers", userIds: [] }).expect(201);
  });

  it("refuses deleting a list whose members changed since the admin saw them", async () => {
    const list: Listed = (
      await create({ name: "Volunteers", userIds: [] }).expect(201)
    ).body;
    await update(list, { userIds: [ctx.testUserId] }).expect(200);
    await saveFormulas({
      deletedLists: [{ id: list.id, baseVersionId: list.versionId }],
    }).expect(409);
    expect(await lists()).toHaveLength(1);
  });

  it("refuses deleting a list whose membership save commits while the deletion waits", async () => {
    const list: Listed = (
      await create({ name: "Volunteers", userIds: [] }).expect(201)
    ).body;
    const membership = ctx.dataSource.createQueryRunner();
    await membership.startTransaction();
    try {
      await membership.manager.find(MemberList, {
        where: { id: list.id },
        lock: { mode: "pessimistic_write" },
      });
      await membership.manager.save(MemberListVersion, {
        listId: list.id,
        savedById: null,
      });
      const deleting = saveFormulas({
        deletedLists: [{ id: list.id, baseVersionId: list.versionId }],
      }).then((response) => response);
      await waitForLockWait(ctx.dataSource);
      await membership.commitTransaction();
      expect((await deleting).status).toBe(409);
    } finally {
      await membership.release();
    }
    expect(await lists()).toHaveLength(1);
  });

  it("refuses naming a list twice in one save, and acting on a deleted list", async () => {
    const list: Listed = (
      await create({ name: "Volunteers", userIds: [] }).expect(201)
    ).body;
    const deletion = { id: list.id, baseVersionId: list.versionId };
    const twice = await saveFormulas({
      deletedLists: [deletion, deletion],
    }).expect(400);
    expect(twice.body.message).toBe(
      "A list appears more than once in this save.",
    );
    await saveFormulas({ deletedLists: [deletion] }).expect(200, {
      problems: [],
    });
    const again = await saveFormulas({ deletedLists: [deletion] }).expect(409);
    expect(again.body.message).toBe(
      "This list was deleted since you opened it. Reload to see the lists as they are now.",
    );
    expect(await lists()).toEqual([]);
    await update(list, { name: "Helpers" }).expect(404);
  });

  it("removes a deleted account from every version of a list", async () => {
    const users = ctx.dataSource.getRepository(User);
    const leaving = await users.save(
      users.create({
        email: "leaving@example.com",
        password: "pass",
        name: "Leaving",
        referralSource: ReferralSource.None,
      }),
    );
    const list: Listed = (
      await create({
        name: "Volunteers",
        userIds: [leaving.id, ctx.testUserId],
      }).expect(201)
    ).body;
    await update(list, { userIds: [leaving.id] }).expect(200);
    await ctx.dataSource.transaction((manager) =>
      softDeleteCascade(manager, { target: User, ids: [leaving.id] }),
    );
    const left = await ctx.dataSource
      .getRepository(MemberListMember)
      .findBy({ userId: leaving.id });
    expect(left).toEqual([]);
    expect((await lists())[0].userIds).toEqual([]);
  });

  it("refuses a member whose account deletion commits while the save waits", async () => {
    const users = ctx.dataSource.getRepository(User);
    const leaving = await users.save(
      users.create({
        email: "leaving@example.com",
        password: "pass",
        name: "Leaving",
        referralSource: ReferralSource.None,
      }),
    );
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: User,
        ids: [leaving.id],
      });
      const saving = create({ name: "Volunteers", userIds: [leaving.id] }).then(
        (response) => response,
      );
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect((await saving).status).toBe(400);
    } finally {
      await deletion.release();
    }
    expect(
      await ctx.dataSource
        .getRepository(MemberListMember)
        .findBy({ userId: leaving.id }),
    ).toEqual([]);
  });
});
