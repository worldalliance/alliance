import { type Repository } from "typeorm";
import { Community } from "../src/community/entities/community.entity";
import { ContractService } from "../src/contract/contract.service";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist invite placement (e2e)", () => {
  let ctx: TestContext;
  let communityRepo: Repository<Community>;
  let userRepo: Repository<User>;

  const saveGroup = (maxCapacity: number) =>
    communityRepo.save({
      name: `Group ${Math.random()}`,
      maxCapacity,
      users: [{ id: ctx.adminUserId }],
    });

  const claimAndSign = async (params: {
    community: Community;
    fromWaitlist: boolean;
  }): Promise<User> => {
    const entry = params.fromWaitlist
      ? await ctx.dataSource.getRepository(WaitlistEntry).save({
          name: "Waiting Person",
          email: `waiting-${Math.random()}@example.com`,
          code: `code-${Math.random()}`,
          committedAt: new Date(),
          reason: "I want to help",
        })
      : null;
    const invite = await ctx.dataSource.getRepository(OnetimeInvite).save({
      invitee: "Claimant",
      code: `invite-${Math.random()}`,
      status: OnetimeInviteStatus.LINK_USED,
      waitlistEntryId: entry?.id ?? null,
      community: params.community,
    });
    const user = await userRepo.save(
      userRepo.create({
        email: `claimant-${Math.random()}@example.com`,
        password: "password",
        name: "Claimant",
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: invite,
      }),
    );
    await ctx.app.get(ContractService).signContract({
      userId: user.id,
      signedName: user.name,
      viaTaskForm: false,
      contractId: ctx.defaultContractId,
    });
    return userRepo.findOneOrFail({
      where: { id: user.id },
      relations: { communities: true },
    });
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    communityRepo = ctx.dataSource.getRepository(Community);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("leaves a waitlist invite's claimant for staff when its group is full", async () => {
    const community = await saveGroup(1);
    const user = await claimAndSign({ community, fromWaitlist: true });
    expect(user.communities).toEqual([]);
    expect(user.undergoingGroupAssignment).toBe(true);
  });

  it("places a waitlist invite's claimant in a group with room", async () => {
    const community = await saveGroup(5);
    const user = await claimAndSign({ community, fromWaitlist: true });
    expect(user.communities.map((joined) => joined.id)).toEqual([community.id]);
  });

  it("places another invite's claimant even in a full group", async () => {
    const community = await saveGroup(1);
    const user = await claimAndSign({ community, fromWaitlist: false });
    expect(user.communities.map((joined) => joined.id)).toEqual([community.id]);
  });
});
