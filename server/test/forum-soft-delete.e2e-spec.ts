import { Action } from "src/actions/entities/action.entity";
import { CommentDto } from "src/forum/dto/comment.dto";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Forum soft deletion (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let emails = 0;

  const server = () => ctx.app.getHttpServer();

  const member = async (): Promise<{ user: User; token: string }> => {
    const user = await userRepo.save(
      userRepo.create({
        name: `Forum Member ${emails}`,
        email: `forum-soft-delete-${emails++}@example.com`,
        password: "password",
      }),
    );
    return { user, token: signAccessToken(ctx.jwtService, user) };
  };

  const createPost = async (token: string): Promise<number> =>
    (
      await request(server())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Discussion",
          editableContent: { body: "Post body", attachments: [] },
        })
        .expect(201)
    ).body.id;

  const comment = (params: {
    token: string;
    postId: number;
    parentId?: number;
    body?: string;
  }) =>
    request(server())
      .post("/forum/comments")
      .set("Authorization", `Bearer ${params.token}`)
      .send({
        parentObjectType: CommentParentObject.Post,
        parentObjectId: params.postId,
        parentId: params.parentId,
        editableContent: {
          body: params.body ?? "A comment",
          attachments: ["attachment-key.webp"],
        },
      });

  const deleteComment = (token: string, id: number) =>
    request(server())
      .delete(`/forum/comments/${id}`)
      .set("Authorization", `Bearer ${token}`);

  const thread = async (postId: number): Promise<CommentDto[]> =>
    (
      await request(server())
        .get(`/forum/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200)
    ).body;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("keeps a deleted comment in its thread without its content", async () => {
    const author = await member();
    const replier = await member();
    const postId = await createPost(ctx.accessToken);
    const parent = (await comment({ ...author, postId }).expect(201)).body;
    const reply = (
      await comment({ ...replier, postId, parentId: parent.id }).expect(201)
    ).body;
    await request(server())
      .post(`/forum/comments/${parent.id}/like`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(201);

    await deleteComment(author.token, parent.id).expect(200);

    const [placeholder] = await thread(postId);
    expect(placeholder).toMatchObject({
      id: parent.id,
      deleted: true,
      author: { id: author.user.id },
      editableContent: { body: "", attachments: [] },
      likes: [],
      likesCount: 0,
      children: [expect.objectContaining({ id: reply.id, deleted: false })],
    });
    expect(placeholder.likedByMe).toBeUndefined();
    expect(
      await ctx.dataSource.getRepository(Comment).findOneOrFail({
        where: { id: parent.id },
        relations: { editableContent: true },
      }),
    ).toMatchObject({
      editableContent: {
        body: "A comment",
        attachments: ["attachment-key.webp"],
      },
    });
  });

  it("unpins a comment when it is deleted", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const pinned = (await comment({ ...author, postId }).expect(201)).body;
    await request(server())
      .patch(`/forum/admin/comments/${pinned.id}/pin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    await deleteComment(author.token, pinned.id).expect(200);

    const [placeholder] = await thread(postId);
    expect(placeholder).toMatchObject({ id: pinned.id, pinned: false });
  });

  it("refuses to edit, like, unlike, or pin a deleted comment", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const deleted = (await comment({ ...author, postId }).expect(201)).body;
    await request(server())
      .post(`/forum/comments/${deleted.id}/like`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(201);
    await deleteComment(author.token, deleted.id).expect(200);

    await request(server())
      .patch(`/forum/comments/${deleted.id}`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ editableContent: { body: "Edited", attachments: [] } })
      .expect(404);
    await request(server())
      .post(`/forum/comments/${deleted.id}/like`)
      .set("Authorization", `Bearer ${author.token}`)
      .expect(404);
    await request(server())
      .post(`/forum/comments/${deleted.id}/unlike`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(404);
    await request(server())
      .patch(`/forum/admin/comments/${deleted.id}/pin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
  });

  it("leaves comments on a deleted action out of a member's comment list", async () => {
    const author = await member();
    const actionRepo = ctx.dataSource.getRepository(Action);
    const commentRepo = ctx.dataSource.getRepository(Comment);
    const kept = await actionRepo.save({
      name: "Kept",
      category: [],
      body: "",
    });
    const removed = await actionRepo.save({
      name: "Removed",
      category: [],
      body: "",
    });
    for (const action of [kept, removed]) {
      await commentRepo.save({
        authorId: author.user.id,
        parentObjectType: CommentParentObject.Action,
        parentObjectId: action.id,
        editableContent: { body: "Hello", attachments: [] },
      });
    }
    await actionRepo.softDelete(removed.id);

    const listed = await request(server())
      .get(`/forum/posts/user/${author.user.id}/comments`)
      .expect(200);

    expect(
      listed.body.map((entry: CommentDto) => entry.parentObjectId),
    ).toEqual([kept.id]);
  });
});
