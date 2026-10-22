import { Community } from "src/community/entities/community.entity";
import { Mms } from "src/mms/mms.entity";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { User } from "src/user/entities/user.entity";
import { In, Not, type Repository } from "typeorm";
import { giveActiveContract, type TestContext } from "./e2e-test-utils";

export class GroupJoinFixtures {
  readonly userRepo: Repository<User>;
  readonly communityRepo: Repository<Community>;
  readonly notifRepo: Repository<Notification>;
  readonly mmsRepo: Repository<Mms>;
  private userCounter = 0;

  constructor(private readonly ctx: TestContext) {
    this.userRepo = ctx.dataSource.getRepository(User);
    this.communityRepo = ctx.dataSource.getRepository(Community);
    this.notifRepo = ctx.dataSource.getRepository(Notification);
    this.mmsRepo = ctx.dataSource.getRepository(Mms);
  }

  createUser = async (
    overrides: Partial<User> = {},
    { signed = true }: { signed?: boolean } = {},
  ): Promise<User> => {
    this.userCounter += 1;
    const user = await this.userRepo.save(
      this.userRepo.create({
        name: `Join Member ${this.userCounter}`,
        email: `join.member.${this.userCounter}@example.com`,
        password: "pass",
        ...overrides,
      }),
    );
    if (signed) await giveActiveContract(this.ctx, user.id);
    return user;
  };

  createGroup = (params: { leaders: User[]; members: User[] }) =>
    this.communityRepo.save(
      this.communityRepo.create({
        name: `Join Group ${++this.userCounter}`,
        public: true,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 10,
        leaders: params.leaders,
        users: params.members,
      }),
    );

  joinNotifs = () =>
    this.notifRepo.find({
      where: { category: NotificationCategory.GroupMemberJoined },
      relations: { user: true, associatedUsers: true },
      order: { id: "ASC" },
    });

  /** Recipient id → ids of the joiners they were told about. */
  announcements = async () => {
    const byRecipient = new Map<number, number[]>();
    for (const notif of await this.joinNotifs()) {
      const joiners = notif.associatedUsers!.map((user) => user.id);
      byRecipient.set(notif.user!.id, [
        ...(byRecipient.get(notif.user!.id) ?? []),
        ...joiners,
      ]);
    }
    for (const joiners of byRecipient.values()) joiners.sort((a, b) => a - b);
    return byRecipient;
  };

  async cleanUp() {
    await this.notifRepo.query("DELETE FROM notification");
    await this.mmsRepo.query("DELETE FROM mms");
    await this.notifRepo.query("DELETE FROM message_tracking");
    await this.notifRepo.query("DELETE FROM user_device");
    await this.notifRepo.query("DELETE FROM community_invite");
    await this.communityRepo.createQueryBuilder().delete().execute();
    await this.userRepo.delete({
      id: Not(In([this.ctx.testUserId, this.ctx.adminUserId])),
    });
  }
}
