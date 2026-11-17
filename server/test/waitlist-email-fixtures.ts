import request from "supertest";
import { EmailStatus, Mail } from "../src/mail/mail.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import type { TestContext } from "./e2e-test-utils";

export const mailWith = (status: EmailStatus) =>
  Object.assign(new Mail(), { status });

export const saveWaitlistEntry = (
  ctx: TestContext,
  fields: Partial<WaitlistEntry> = {},
) => {
  const repo = ctx.dataSource.getRepository(WaitlistEntry);
  return repo.save(
    repo.create({
      name: "Test Person",
      email: `person-${Math.random()}@example.com`,
      code: `code-${Math.random()}`,
      committedAt: new Date(),
      reason: "I want to help",
      ...fields,
    }),
  );
};

export const postWaitlistEmail = (
  ctx: TestContext,
  body: Record<string, unknown>,
) =>
  request(ctx.app.getHttpServer())
    .post("/waitlist/admin/emails")
    .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
    .send({
      subject: "Hi #{name}",
      body: "Welcome",
      includeClaimed: false,
      mobilize: false,
      requestId: crypto.randomUUID(),
      ...body,
    })
    .expect(201);
