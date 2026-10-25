import { CommentDto } from "src/forum/dto/comment.dto";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import { signAccessToken, TestContext } from "./e2e-test-utils";

export function createForumSoftDeleteFixtures(getCtx: () => TestContext) {
  let emails = 0;

  const server = () => getCtx().app.getHttpServer();

  const member = async (): Promise<{ user: User; token: string }> => {
    const ctx = getCtx();
    const userRepo = ctx.dataSource.getRepository(User);
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
        .set("Authorization", `Bearer ${getCtx().accessToken}`)
        .expect(200)
    ).body;

  return { server, member, createPost, comment, deleteComment, thread };
}
