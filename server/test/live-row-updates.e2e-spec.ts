import { ConversationType } from "@alliance/common/conversationType";
import { ParticipantRole } from "@alliance/common/participantRole";
import { NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { ActionFormVariant } from "src/actions/entities/action-form-variant.entity";
import { Action } from "src/actions/entities/action.entity";
import { Conversation } from "src/messaging/entities/conversation.entity";
import {
  Participant,
  ParticipantState,
} from "src/messaging/entities/participant.entity";
import { MessageService } from "src/messaging/message.service";
import { Notification } from "src/notifs/entities/notification.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import { ShareUrl } from "src/share-urls/entities/share-url.entity";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import { AmbassadorInviteGoal } from "src/user/entities/ambassador-invite-goal.entity";
import { AmbassadorProgramMember } from "src/user/entities/ambassador-program-member.entity";
import { Friend, FriendStatus } from "src/user/entities/friend.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { User } from "src/user/entities/user.entity";
import { FriendService } from "src/user/friend.service";
import { OnetimeInviteService } from "src/user/onetime-invite.service";
import { UserService } from "src/user/user.service";
import {
  EntityManager,
  Repository,
  type EntityTarget,
  type FindOneOptions,
  type ObjectLiteral,
} from "typeorm";
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
  waitForLockWait,
} from "./e2e-test-utils";

describe("Updates to a row deleted after its load (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let userService: UserService;
  let friendService: FriendService;
  let emails = 0;

  const member = (overrides: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        name: "Updated Member",
        email: `live-update-${emails++}@example.com`,
        password: "password",
        ...overrides,
      }),
    );

  const injected = <T extends ObjectLiteral>(entity: new () => T) =>
    ctx.app.get<Repository<T>>(getRepositoryToken(entity));

  const deleteAfterLoad = <T extends ObjectLiteral>(params: {
    repo: Repository<T>;
    method: "findOne" | "findOneOrFail";
    entity: new () => ObjectLiteral;
    id: number | string;
  }) => {
    const { repo, method, entity, id } = params;
    const load = repo[method].bind(repo);
    jest
      .spyOn(repo, method)
      .mockImplementationOnce(async (options: FindOneOptions<T>) => {
        const loaded = await load(options);
        await ctx.dataSource.getRepository(entity).softDelete(id);
        return loaded;
      });
  };

  const stored = <T extends ObjectLiteral>(
    entity: new () => T,
    id: number | string,
  ) =>
    ctx.dataSource
      .createQueryBuilder(entity, "row")
      .withDeleted()
      .where("row.id = :id", { id })
      .getOneOrFail();

  // Unlike writeDuringDeletion, which holds the row FOR UPDATE, the deletion
  // holds only the lock its UPDATE takes, so the writer waits only if its
  // own lock conflicts with that one.
  const writeDuringSoftDelete = async (params: {
    target: EntityTarget<ObjectLiteral>;
    id: number;
    write: () => Promise<unknown>;
  }) => {
    const runner = ctx.dataSource.createQueryRunner();
    await runner.startTransaction();
    try {
      await runner.manager.softDelete(params.target, params.id);
      const settled = params.write().then(
        (value) => value,
        (err: unknown) => err,
      );
      await waitForLockWait(ctx.dataSource);
      await runner.commitTransaction();
      return await settled;
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    userService = ctx.app.get(UserService);
    friendService = ctx.app.get(FriendService);
  }, 50000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("leaves a friend request deleted while its addressee accepts it", async () => {
    const [requester, addressee] = await Promise.all([member(), member()]);
    const request = await ctx.dataSource.getRepository(Friend).save({
      requester,
      addressee,
      status: FriendStatus.Pending,
    });
    deleteAfterLoad({
      repo: injected(Friend),
      method: "findOne",
      entity: Friend,
      id: request.id,
    });

    await expect(
      friendService.updateFriendRequestStatus(
        requester.id,
        addressee.id,
        FriendStatus.Accepted,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(await stored(Friend, request.id)).toMatchObject({
      status: FriendStatus.Pending,
      deletedAt: expect.any(Date),
    });
  });

  it("leaves an ambassador program member deleted while it is edited", async () => {
    const user = await member();
    const programMember = await ctx.dataSource
      .getRepository(AmbassadorProgramMember)
      .save({ user, invited: false });
    deleteAfterLoad({
      repo: injected(AmbassadorProgramMember),
      method: "findOne",
      entity: AmbassadorProgramMember,
      id: programMember.id,
    });

    await expect(
      userService.updateAmbassadorProgramMember(user.id, { invited: true }),
    ).rejects.toThrow(
      new NotFoundException("Ambassador program member not found"),
    );
    expect(
      await stored(AmbassadorProgramMember, programMember.id),
    ).toMatchObject({ invited: false, deletedAt: expect.any(Date) });
  });

  it("leaves an ambassador invite goal deleted while it is edited", async () => {
    const ambassador = await member({ ambassador: true });
    const goal = await ctx.dataSource.getRepository(AmbassadorInviteGoal).save({
      ambassador,
      targetSuccessfulRecruits: 3,
      startAt: new Date("2099-01-01T00:00:00Z"),
      dueAt: new Date("2099-02-01T00:00:00Z"),
    });
    deleteAfterLoad({
      repo: injected(AmbassadorInviteGoal),
      method: "findOneOrFail",
      entity: AmbassadorInviteGoal,
      id: goal.id,
    });

    await expect(
      userService.updateAmbassadorInviteGoal(
        goal.id,
        { targetSuccessfulRecruits: 5 },
        ambassador.id,
      ),
    ).rejects.toThrow(
      new NotFoundException("Ambassador invite goal not found"),
    );
    expect(await stored(AmbassadorInviteGoal, goal.id)).toMatchObject({
      targetSuccessfulRecruits: 3,
      deletedAt: expect.any(Date),
    });
  });

  it("leaves a one-time invite deleted while its inviter edits it", async () => {
    const inviter = await member();
    const invite = await ctx.dataSource.getRepository(OnetimeInvite).save({
      invitee: "Before",
      code: `live-update-${emails++}`,
      status: OnetimeInviteStatus.LINK_UNUSED,
      invitingUser: inviter,
    });
    deleteAfterLoad({
      repo: injected(OnetimeInvite),
      method: "findOneOrFail",
      entity: OnetimeInvite,
      id: invite.id,
    });

    await expect(
      ctx.app.get(OnetimeInviteService).updateOnetimeInvite({
        inviteId: invite.id,
        userId: inviter.id,
        invitee: "After",
      }),
    ).rejects.toThrow(NotFoundException);
    expect(await stored(OnetimeInvite, invite.id)).toMatchObject({
      invitee: "Before",
      deletedAt: expect.any(Date),
    });
  });

  it("leaves a like notification deleted while one of its likers unlikes", async () => {
    const [owner, first, second] = await Promise.all([
      member(),
      member(),
      member(),
    ]);
    const likes = ctx.app.get(LikeNotificationService);
    for (const liker of [first, second]) {
      await likes.createOrUpdate({
        owner,
        liker,
        targetType: "post",
        targetId: owner.id,
        webAppLocation: "/forum",
        targetContent: "Liked post",
      });
    }
    const notifs = ctx.dataSource.getRepository(Notification);
    const notif = await notifs.findOneByOrFail({ user: { id: owner.id } });
    const load = Repository.prototype.findOne;
    jest
      .spyOn(Repository.prototype, "findOne")
      .mockImplementationOnce(async function (
        this: Repository<ObjectLiteral>,
        options,
      ) {
        const loaded = await load.call(this, options);
        await notifs.softDelete(notif.id);
        return loaded;
      });

    await likes.removeOnUnlike({
      ownerId: owner.id,
      unlikerId: first.id,
      targetType: "post",
      targetId: owner.id,
    });

    expect(await stored(Notification, notif.id)).toMatchObject({
      groupingCount: 2,
      deletedAt: expect.any(Date),
    });
  });

  it("leaves a share link deleted while an admin relabels it", async () => {
    const owner = await member();
    const shareUrls = ctx.app.get(ShareUrlsService);
    const link = await shareUrls.createDuplicateInviteForUser(
      owner.id,
      "Before",
      null,
    );
    await ctx.dataSource.getRepository(ShareUrl).softDelete(link.id);

    await expect(shareUrls.updateLabel(link.id, "After")).rejects.toThrow(
      NotFoundException,
    );
    expect(await stored(ShareUrl, link.id)).toMatchObject({
      label: "Before",
      deletedAt: expect.any(Date),
    });
  });

  it("leaves a chat participant deleted while their message sends", async () => {
    const author = await member();
    const conversation = await ctx.dataSource
      .getRepository(Conversation)
      .save({ type: ConversationType.Multiple, title: "Chat" });
    const participants = ctx.dataSource.getRepository(Participant);
    const participant = await participants.save({
      conversation,
      user: author,
      role: ParticipantRole.Member,
      state: ParticipantState.Invited,
      joinedAt: new Date(),
    });
    const save = EntityManager.prototype.save;
    jest
      .spyOn(EntityManager.prototype, "save")
      .mockImplementationOnce(async function (
        this: EntityManager,
        ...args: Parameters<EntityManager["save"]>
      ) {
        const saved = await save.apply(this, args);
        await participants.softDelete(participant.id);
        return saved;
      });

    await ctx.app
      .get(MessageService)
      .sendMessage(author.id, { conversationId: conversation.id, body: "Hi" });

    expect(
      await participants.findOneOrFail({
        where: { id: participant.id },
        withDeleted: true,
        loadRelationIds: { relations: ["lastReadMessage"] },
      }),
    ).toMatchObject({
      state: ParticipantState.Invited,
      lastReadMessage: null,
      deletedAt: expect.any(Date),
    });
  });

  it("leaves a form variant deleted while its edit waits on the deletion", async () => {
    const action = await ctx.dataSource
      .getRepository(Action)
      .save({ name: "Variant action", category: [], body: "Body" });
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Variant form",
      schema: { pages: [], outputViews: [] },
    });
    const variant = await ctx.dataSource.getRepository(ActionFormVariant).save({
      actionId: action.id,
      formId: form.id,
      name: "Before",
      splitValue: 0.5,
    });

    expect(
      await writeDuringSoftDelete({
        target: ActionFormVariant,
        id: variant.id,
        write: () =>
          ctx.app
            .get(ActionFormVariantService)
            .updateVariant(variant.id, { name: "After" }),
      }),
    ).toBeInstanceOf(NotFoundException);
    expect(await stored(ActionFormVariant, variant.id)).toMatchObject({
      name: "Before",
      deletedAt: expect.any(Date),
    });
  });

  it("leaves an account deleted while its profile edit waits on the deletion", async () => {
    const user = await member({ name: "Before" });

    expect(
      await writeDuringSoftDelete({
        target: User,
        id: user.id,
        write: () => userService.update(user.id, { name: "After" }),
      }),
    ).toBeInstanceOf(NotFoundException);
    expect(await stored(User, user.id)).toMatchObject({
      name: "Before",
      deletedAt: expect.any(Date),
    });
  });
});
