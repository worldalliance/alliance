import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import {
  createActionAsAdmin,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-nullable-text e2e";
const fields = ["squareThumbnailImageAlt", "customStatLabel"] as const;

describe("Action nullable text (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource
      .getRepository(Action)
      .delete({ name: Like(`${NAME_PREFIX}%`) });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const create = (body: Partial<CreateActionDto>) =>
    createActionAsAdmin(ctx, { name: NAME_PREFIX, ...body });

  const patch = (id: number, body: Record<string, unknown>) =>
    patchActionAsAdmin(ctx, id, body);

  describe.each(fields)("%s", (field) => {
    const stored = async (id: number) =>
      (await ctx.dataSource.getRepository(Action).findOneByOrFail({ id }))[
        field
      ];

    it("returns null on an action created without it", async () => {
      const created = await create({}).expect(201);
      expect(created.body[field]).toBeNull();

      const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
      expect(fetched.body[field]).toBeNull();
    });

    it("keeps it when a patch leaves it out and clears it with null", async () => {
      const created = await create({ [field]: "A cup of coffee" }).expect(201);

      const renamed = await patch(created.body.id, {
        name: `${NAME_PREFIX} renamed`,
      }).expect(200);
      expect(renamed.body[field]).toBe("A cup of coffee");

      const cleared = await patch(created.body.id, { [field]: null }).expect(
        200,
      );
      expect(cleared.body[field]).toBeNull();
      expect(await stored(created.body.id)).toBeNull();
    });

    it("stores typed text trimmed", async () => {
      const created = await create({
        [field]: "  A cup of coffee ",
      }).expect(201);
      expect(created.body[field]).toBe("A cup of coffee");
      expect(await stored(created.body.id)).toBe("A cup of coffee");
    });

    it.each(["", "   "])("stores %p as null", async (blank) => {
      const created = await create({ [field]: "A cup of coffee" }).expect(201);
      const blanked = await patch(created.body.id, {
        [field]: blank,
      }).expect(200);
      expect(blanked.body[field]).toBeNull();
      expect(await stored(created.body.id)).toBeNull();
    });

    it("rejects a value that isn't a string", async () => {
      const created = await create({}).expect(201);
      await patch(created.body.id, { [field]: 5 }).expect(400);
    });
  });
});
