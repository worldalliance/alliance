import request from "supertest";
import {
  CustomValidator,
  CustomValidatorType,
} from "../src/tasks/entities/customvalidator.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import { Tag } from "../src/user/entities/tag.entity";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Running a validator as a previewed member (e2e)", () => {
  let ctx: TestContext;
  let validatorId: number;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    const memberOnlyTag = await ctx.dataSource
      .getRepository(Tag)
      .save({ name: "Member only", description: "Member only" });
    const users = ctx.dataSource.getRepository(User);
    const member = await users.findOneOrFail({
      where: { id: ctx.testUserId },
      relations: { tags: true },
    });
    await users.save({
      ...member,
      tags: [...(member.tags ?? []), memberOnlyTag],
    });
    ({ id: validatorId } = await ctx.dataSource
      .getRepository(CustomValidator)
      .save({
        type: CustomValidatorType.MemberTag,
        idArgument: memberOnlyTag.id,
        expression: null,
      }));
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const run = (path: string, token: string) =>
    request(ctx.app.getHttpServer())
      .post(`/tasks/runValidator/${path}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

  it("checks the previewed member, not the admin running it", async () => {
    const asAdmin = await run(`${validatorId}`, ctx.adminAccessToken);
    const asMember = await run(
      `${validatorId}/asUser/${ctx.testUserId}`,
      ctx.adminAccessToken,
    );

    expect(asAdmin.body.isValid).toBe(false);
    expect(asMember.status).toBe(201);
    expect(asMember.body.isValid).toBe(true);
  });

  it("refuses a member running a validator as someone else", async () => {
    const response = await run(
      `${validatorId}/asUser/${ctx.adminUserId}`,
      ctx.accessToken,
    );

    expect(response.status).toBe(401);
  });
});
