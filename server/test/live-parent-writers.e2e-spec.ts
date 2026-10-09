import { CommunityService } from "src/community/community.service";
import { Community } from "src/community/entities/community.entity";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import {
  createTestApp,
  giveActiveContract,
  TestContext,
} from "./e2e-test-utils";

describe("Writers beside a deletion (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let emails = 0;

  const member = (overrides: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        name: "Writer Member",
        email: `writer-${emails++}@example.com`,
        password: "password",
        ...overrides,
      }),
    );

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("a member deleted after a membership edit loads the group", () => {
    const setUp = async () => {
      const leader = await member();
      const departing = await member();
      const communities = ctx.dataSource.getRepository(Community);
      const { id } = await communities.save({
        name: "Group losing a member",
        description: "Shrinking",
        leaders: [leader, departing],
        users: [leader, departing],
      });
      const community = await communities.findOneOrFail({
        where: { id },
        relations: { users: true, leaders: true },
      });
      const deleteDeparting = async () => {
        await userRepo.softDelete(departing.id);
        for (const table of [
          "community_users_user",
          "community_leaders_user",
        ]) {
          await ctx.dataSource.query(
            `DELETE FROM ${table} WHERE "userId" = $1`,
            [departing.id],
          );
        }
      };
      const memberships = async (): Promise<number> =>
        (
          await ctx.dataSource.query(
            `SELECT (SELECT count(*) FROM community_users_user WHERE "userId" = $1)
                  + (SELECT count(*) FROM community_leaders_user WHERE "userId" = $1) AS count`,
            [departing.id],
          )
        )[0].count;
      return { leader, community, deleteDeparting, memberships };
    };

    it("writes none of its memberships back when someone joins", async () => {
      const { community, deleteDeparting, memberships } = await setUp();
      const joiner = await member();
      await giveActiveContract(ctx, joiner.id);
      await deleteDeparting();

      await ctx.app
        .get(CommunityService)
        .addUsersToCommunityAndRefreshConversation({
          community,
          user: joiner,
          notifForLeader: () => null,
        });

      expect(Number(await memberships())).toBe(0);
    });

    it("writes none of its memberships back when a leader steps down", async () => {
      const { leader, community, deleteDeparting, memberships } = await setUp();
      const communityService = ctx.app.get(CommunityService);
      jest
        .spyOn(communityService, "findOneOrFail")
        .mockImplementationOnce(async () => {
          await deleteDeparting();
          return community;
        });

      await communityService.removeLeaderAdmin(community.id, leader.id);

      expect(Number(await memberships())).toBe(0);
    });
  });

  it("makes a leader of a member a concurrent request already promoted", async () => {
    const leader = await member();
    const promoted = await member();
    const { id } = await ctx.dataSource.getRepository(Community).save({
      name: "Group promoting twice",
      description: "Twice",
      leaders: [leader],
      users: [leader],
    });
    const communityService = ctx.app.get(CommunityService);
    const findOneOrFail = communityService.findOneOrFail.bind(communityService);
    jest
      .spyOn(communityService, "findOneOrFail")
      .mockImplementationOnce(async (...args) => {
        const loaded = await findOneOrFail(...args);
        for (const table of [
          "community_users_user",
          "community_leaders_user",
        ]) {
          await ctx.dataSource.query(
            `INSERT INTO ${table} ("communityId", "userId") VALUES ($1, $2)`,
            [id, promoted.id],
          );
        }
        return loaded;
      });

    await communityService.addLeaderAdmin(id, promoted.id);

    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int AS count FROM community_leaders_user WHERE "userId" = $1`,
      [promoted.id],
    );
    expect(count).toBe(1);
  });
});
