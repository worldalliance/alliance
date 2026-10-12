import { hasProfilePicture } from "@alliance/common/profilePicture";
import { randomUUID } from "crypto";
import type { Repository } from "typeorm";
import { User } from "../src/user/entities/user.entity";
import { sqlUserHasProfilePicture } from "../src/user/profile-picture";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Profile picture presence (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it.each([null, "", "  ", "\t\n", "key.webp"])(
    "agrees with hasProfilePicture in SQL for %p",
    async (profilePicture) => {
      const user = await userRepo.save(
        userRepo.create({
          name: "Pictured Member",
          email: `pictured-${randomUUID()}@example.com`,
          password: "Password123!",
          profilePicture,
        }),
      );

      const matched = await userRepo
        .createQueryBuilder("u")
        .where("u.id = :id", { id: user.id })
        .andWhere(sqlUserHasProfilePicture('u."profilePicture"'))
        .getExists();

      expect(matched).toBe(hasProfilePicture({ profilePicture }));
    },
  );
});
