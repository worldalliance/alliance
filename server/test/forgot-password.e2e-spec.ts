import { MailService } from "src/mail/mail.service";
import request from "supertest";
import type { Repository } from "typeorm";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Forgot password (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it.each([
    { password: "pass", hasPassword: true },
    { password: null, hasPassword: false },
  ])(
    "mails hasPassword $hasPassword to a member with that password state",
    async ({ password, hasPassword }) => {
      const member = await userRepo.save(
        userRepo.create({
          name: "Forgetful Member",
          email: `forgot-${hasPassword}@example.com`,
          password,
        }),
      );

      const send = jest.spyOn(
        ctx.app.get(MailService),
        "sendPasswordResetEmail",
      );
      try {
        await request(ctx.app.getHttpServer())
          .post("/auth/forgot-password")
          .send({ email: member.email })
          .expect(200);

        expect(send).toHaveBeenCalledWith(
          expect.objectContaining({ email: member.email, hasPassword }),
        );
      } finally {
        send.mockRestore();
      }
    },
  );
});
