import { ConversationCreationService } from "src/messaging/conversation-creation.service";
import {
  Participant,
  ParticipantState,
} from "src/messaging/entities/participant.entity";
import { MessagingModule } from "src/messaging/messaging.module";
import { FriendStatus } from "src/user/entities/friend.entity";
import { User } from "src/user/entities/user.entity";
import { ReferralService } from "src/user/referral.service";
import { UserService } from "src/user/user.service";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  createTestApp,
  eventually,
  giveActiveContract,
  signAccessToken,
  TestContext,
} from "./e2e-test-utils";

describe("Accepted friendship in either direction (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let userService: UserService;

  let hub: User;
  let hubToken: string;
  let requesterFriend: User;
  let requesterFriendToken: string;
  let addresseeFriend: User;
  let pendingRequester: User;
  let pendingRequesterToken: string;
  let pendingAddressee: User;

  const saveUser = (label: string) =>
    userRepo.save(
      userRepo.create({
        name: `Friendship ${label}`,
        email: `friendship.${label.toLowerCase()}@example.com`,
        password: "Password123!",
        profilePicture: `${label.toLowerCase()}.jpg`,
      }),
    );

  const get = (path: string, token: string) =>
    request(ctx.app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

  const ids = (users: { id: number }[]) => users.map((u) => u.id);

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
    userService = ctx.app.get(UserService);

    pendingRequester = await saveUser("PendingRequester");
    pendingAddressee = await saveUser("PendingAddressee");
    hub = await saveUser("Hub");
    requesterFriend = await saveUser("RequesterFriend");
    addresseeFriend = await saveUser("AddresseeFriend");
    for (const user of [
      pendingRequester,
      pendingAddressee,
      hub,
      requesterFriend,
      addresseeFriend,
    ]) {
      await giveActiveContract(ctx, user.id);
    }
    hubToken = signAccessToken(ctx.jwtService, hub);
    requesterFriendToken = signAccessToken(ctx.jwtService, requesterFriend);
    pendingRequesterToken = signAccessToken(ctx.jwtService, pendingRequester);

    await userService.makeFriendsAutomated(requesterFriend.id, hub.id);
    await userService.makeFriendsAutomated(hub.id, addresseeFriend.id);
    await userService.createFriendRequest(pendingRequester.id, hub.id);
    await userService.createFriendRequest(hub.id, pendingAddressee.id);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("lists friends on both sides of the request, without pending ones", async () => {
    const hubFriends = await get(`/user/listfriends/${hub.id}`, hubToken);
    expect(ids(hubFriends.body).sort((a, b) => a - b)).toEqual([
      requesterFriend.id,
      addresseeFriend.id,
    ]);

    const requesterFriends = await get(
      `/user/listfriends/${requesterFriend.id}`,
      requesterFriendToken,
    );
    expect(ids(requesterFriends.body)).toEqual([hub.id]);
  });

  it("lists friends on both sides of the request as messageable, but not pending ones", async () => {
    const hubMessageable = ids(
      (await get("/user/listMessageableUsers", hubToken)).body,
    );
    expect(hubMessageable).toContain(requesterFriend.id);
    expect(hubMessageable).toContain(addresseeFriend.id);
    expect(hubMessageable).not.toContain(pendingRequester.id);
    expect(hubMessageable).not.toContain(pendingAddressee.id);

    const pendingMessageable = ids(
      (await get("/user/listMessageableUsers", pendingRequesterToken)).body,
    );
    expect(pendingMessageable).not.toContain(hub.id);
  });

  it("gives each member friend ids from both sides of the request", async () => {
    const res = await get("/user/membersWithFriends", hubToken);
    const friendIdsOf = (id: number) =>
      res.body
        .find((member: { id: number }) => member.id === id)
        .friendIds.sort((a: number, b: number) => a - b);

    expect(friendIdsOf(hub.id)).toEqual([
      requesterFriend.id,
      addresseeFriend.id,
    ]);
    expect(friendIdsOf(requesterFriend.id)).toEqual([hub.id]);
    expect(friendIdsOf(pendingRequester.id)).toEqual([]);
    expect(friendIdsOf(pendingAddressee.id)).toEqual([]);
  });

  it("reports the relationship from either user's side", async () => {
    const statusOf = async (targetId: number, token: string) =>
      (await get(`/user/myfriendrelationship/${targetId}`, token)).body;

    expect(await statusOf(requesterFriend.id, hubToken)).toEqual({
      status: FriendStatus.Accepted,
      didReceiveRequest: false,
    });
    expect(await statusOf(hub.id, requesterFriendToken)).toEqual({
      status: FriendStatus.Accepted,
      didReceiveRequest: false,
    });
    expect(await statusOf(pendingRequester.id, hubToken)).toEqual({
      status: FriendStatus.Pending,
      didReceiveRequest: true,
    });
    expect(await statusOf(hub.id, pendingRequesterToken)).toEqual({
      status: FriendStatus.Pending,
      didReceiveRequest: false,
    });
    expect(await statusOf(pendingAddressee.id, hubToken)).toEqual({
      status: FriendStatus.Pending,
      didReceiveRequest: false,
    });
  });

  it("shows the inviter's friends from both sides as signup social proof", async () => {
    // Asks the friend lookup directly: getSignupSocialProof tops up with random
    // members drawn from the same pool, which can hide a missing friend.
    const friends = await ctx.app
      .get(ReferralService)
      ["findFriendUsersWithProfilePictures"](hub.id);
    expect(ids(friends)).toEqual([requesterFriend.id, addresseeFriend.id]);
  });

  it("joins a friend on either side straight into a direct message, but not a pending one", async () => {
    const targetStateOf = async (targetUserId: number) => {
      const res = await request(ctx.app.getHttpServer())
        .post("/messaging/conversations/direct")
        .set("Authorization", `Bearer ${hubToken}`)
        .send({ targetUserId })
        .expect(201);
      return res.body.participants.find(
        (participant: { user: { id: number } }) =>
          participant.user.id === targetUserId,
      ).state;
    };

    expect(await targetStateOf(requesterFriend.id)).toBe(
      ParticipantState.Joined,
    );
    expect(await targetStateOf(addresseeFriend.id)).toBe(
      ParticipantState.Joined,
    );
    expect(await targetStateOf(pendingRequester.id)).toBe(
      ParticipantState.Invited,
    );
    expect(await targetStateOf(pendingAddressee.id)).toBe(
      ParticipantState.Invited,
    );
  });

  it("joins a pending direct-message invitee once the two become friends", async () => {
    const sender = await saveUser("DirectSender");
    const invitee = await saveUser("DirectInvitee");
    const conversation = await ctx.app
      .get(ConversationCreationService)
      .createDirectConversation(sender.id, { targetUserId: invitee.id });
    const inviteeState = async () =>
      (
        await ctx.dataSource.getRepository(Participant).findOneByOrFail({
          conversation: { id: conversation.id },
          user: { id: invitee.id },
        })
      ).state;
    expect(await inviteeState()).toBe(ParticipantState.Invited);

    await userService.makeFriendsAutomated(sender.id, invitee.id);

    await eventually(
      inviteeState,
      (state) => state === ParticipantState.Joined,
      "the invitee to join",
    );
  });
});
