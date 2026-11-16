import request from "supertest";
import { getImageSource } from "../src/images/images.service";
import { User } from "../src/user/entities/user.entity";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin users list (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("lists each user's stored profile picture beside the rendered one", async () => {
    const key = "1762925939234.webp";
    const userRepo = ctx.dataSource.getRepository(User);
    const pictured = await userRepo.save(
      userRepo.create({
        name: "Pictured member",
        email: "pictured.member@example.com",
        password: "pass",
        profilePicture: key,
      }),
    );

    const list = await request(ctx.app.getHttpServer())
      .get("/user/list")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    expect(
      list.body.find((user: { id: number }) => user.id === pictured.id),
    ).toMatchObject({
      storedProfilePicture: key,
      profilePicture: getImageSource(key),
    });
  });
});
