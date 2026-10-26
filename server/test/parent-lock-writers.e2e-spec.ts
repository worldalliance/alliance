import { NotFoundException } from "@nestjs/common";
import { CommunityInvitesService } from "src/community/community-invites.service";
import { CommunityService } from "src/community/community.service";
import { CommunityInvite } from "src/community/entities/community-invite.entity";
import { Community } from "src/community/entities/community.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { ForumCommentService } from "src/forum/forum-comment.service";
import { ForumService } from "src/forum/forum.service";
import { Friend } from "src/user/entities/friend.entity";
import { User } from "src/user/entities/user.entity";
import { FriendService } from "src/user/friend.service";
import { UserService } from "src/user/user.service";
import type { Repository } from "typeorm";
import {
  createTestApp,
  TestContext,
  writeDuringDeletion,
} from "./e2e-test-utils";

describe("Writers locking the parents they attach to (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let emails = 0;

  const member = () =>
    userRepo.save(
      userRepo.create({
        name: "Parent Lock Member",
        email: `parent-lock-${emails++}@example.com`,
        password: "password",
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

  it("refuses a friend request to an account deleted after it loads", async () => {
    const requester = await member();
    const addressee = await member();
    const userService = ctx.app.get(UserService);
    const findOneOrFail = userService.findOneOrFail.bind(userService);
    jest
      .spyOn(userService, "findOneOrFail")
      .mockImplementationOnce(findOneOrFail)
      .mockImplementationOnce(async (id, relations) => {
        const loaded = await findOneOrFail(id, relations);
        await userRepo.softDelete(addressee.id);
        return loaded;
      });

    await expect(
      ctx.app
        .get(FriendService)
        .createFriendRequest(requester.id, addressee.id),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(Friend).find({
        where: { addressee: { id: addressee.id } },
        withDeleted: true,
      }),
    ).toEqual([]);
  });

  it("refuses a group invite into a group deleted after it loads", async () => {
    const invitee = await member();
    const communities = ctx.dataSource.getRepository(Community);
    const community = await communities.save({
      name: "Group deleted mid-invite",
      description: "Doomed",
    });
    const communityService = ctx.app.get(CommunityService);
    const findOneOrFail = communityService.findOneOrFail.bind(communityService);
    jest
      .spyOn(communityService, "findOneOrFail")
      .mockImplementationOnce(async (...args) => {
        const loaded = await findOneOrFail(...args);
        await communities.softDelete(community.id);
        return loaded;
      });

    await expect(
      ctx.app
        .get(CommunityInvitesService)
        .createCommunityInvite(
          { invitedUserId: invitee.id, communityId: community.id },
          ctx.adminUserId,
        ),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(CommunityInvite).find({
        where: { community: { id: community.id } },
        withDeleted: true,
      }),
    ).toEqual([]);
  });

  it("refuses a reply under a comment whose author is deleted while it waits", async () => {
    const postAuthor = await member();
    const departing = await member();
    const replier = await member();
    const forum = ctx.app.get(ForumService);
    const commentService = ctx.app.get(ForumCommentService);
    const post = await forum.createPost(
      {
        title: "Discussion",
        editableContent: { body: "Post body", attachments: [] },
      },
      postAuthor.id,
    );
    const onPost = (body: string, parentId?: number) => ({
      parentObjectType: CommentParentObject.Post,
      parentObjectId: post.id,
      parentId,
      editableContent: { body, attachments: [] },
    });
    const ancestor = await commentService.createComment(
      onPost("Ancestor"),
      departing.id,
    );
    const parent = await commentService.createComment(
      onPost("Parent", ancestor.id),
      replier.id,
    );

    expect(
      await writeDuringDeletion({
        dataSource: ctx.dataSource,
        target: User,
        id: departing.id,
        write: () =>
          commentService.createComment(onPost("Raced", parent.id), replier.id),
      }),
    ).toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource
        .getRepository(Comment)
        .find({ where: { parentId: parent.id }, withDeleted: true }),
    ).toEqual([]);
  });
});
