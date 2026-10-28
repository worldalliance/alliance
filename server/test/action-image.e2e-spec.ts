import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import { getImageSource } from "../src/images/images.service";
import {
  createActionAsAdmin,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-image e2e";
const coverKey = "1770253186000.webp";

describe("Action image (e2e)", () => {
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

  const storedImage = async (id: number) =>
    (await ctx.dataSource.getRepository(Action).findOneByOrFail({ id })).image;

  it("returns null for the image on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body.image).toBeNull();

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body.image).toBeNull();
    expect(fetched.body.storedImage).toBeNull();
    expect(await storedImage(created.body.id)).toBeNull();
  });

  it.each(["", "   "])("stores a blank image %p as null", async (image) => {
    const created = await create({ image }).expect(201);
    expect(created.body.image).toBeNull();
    expect(await storedImage(created.body.id)).toBeNull();

    const withImage = await create({ image: coverKey }).expect(201);
    const cleared = await patch(withImage.body.id, { image }).expect(200);
    expect(cleared.body.image).toBeNull();
    expect(await storedImage(withImage.body.id)).toBeNull();
  });

  it("trims the image, keeps it when a patch leaves it out, and clears it with null", async () => {
    const created = await create({ image: `  ${coverKey} ` }).expect(201);
    expect(created.body.image).toBe(getImageSource(coverKey));
    expect(await storedImage(created.body.id)).toBe(coverKey);

    const renamed = await patch(created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.image).toBe(getImageSource(coverKey));

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body.storedImage).toBe(coverKey);

    const cleared = await patch(created.body.id, { image: null }).expect(200);
    expect(cleared.body.image).toBeNull();
    expect(await storedImage(created.body.id)).toBeNull();
  });

  it.each([42, true, { src: "a.webp" }])(
    "rejects an image of %p",
    async (image) => {
      const created = await create({}).expect(201);
      await patch(created.body.id, { image }).expect(400);
    },
  );
});
