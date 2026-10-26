import { ReferralSource, User } from "src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Retired user columns (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  // The deploy that drops these columns migrates while this release still serves.
  it("inserts, loads, and updates a user once they are dropped", async () => {
    const retired = ctx.dataSource
      .getMetadata(User)
      .columns.filter((column) => column.propertyName.startsWith("legacy"));
    expect(retired.length).toBeGreaterThan(0);

    const runner = ctx.dataSource.createQueryRunner();
    await runner.startTransaction();
    try {
      for (const column of retired) {
        await runner.query(
          `ALTER TABLE "user" DROP COLUMN "${column.databaseName}"`,
        );
      }
      const users = runner.manager.getRepository(User);
      const { id } = await users.save(
        users.create({
          email: "retired-columns@example.com",
          password: "pass",
          name: "Pat Member",
          referralSource: ReferralSource.None,
          tags: [ctx.defaultTag],
        }),
      );
      const user = await users.findOneByOrFail({ id });
      user.name = "Pat Renamed";
      user.legacyPushesForLikes = false;
      await users.save(user);

      expect((await users.findOneByOrFail({ id })).name).toBe("Pat Renamed");
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
