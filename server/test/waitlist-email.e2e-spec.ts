import request from "supertest";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist email admin (e2e)", () => {
  let ctx: TestContext;

  const server = () => ctx.app.getHttpServer();
  const asAdmin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const template = (fields: Record<string, unknown> = {}) => ({
    name: `Template ${Math.random()}`,
    subject: "Hi #{name}",
    body: "Join with #{signupLink}",
    ...fields,
  });

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("templates", () => {
    it("rejects non-admins", async () => {
      await request(server())
        .get("/waitlist/admin/email-templates")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it("creates, lists, updates, and deletes a template", async () => {
      const created = await asAdmin(
        request(server()).post("/waitlist/admin/email-templates"),
      )
        .send(template({ name: "  Followup  " }))
        .expect(201);
      expect(created.body).toMatchObject({
        name: "Followup",
        subject: "Hi #{name}",
        body: "Join with #{signupLink}",
      });

      await asAdmin(
        request(server()).put(
          `/waitlist/admin/email-templates/${created.body.id}`,
        ),
      )
        .send(template({ name: "Followup", subject: "Hello #{name}" }))
        .expect(200);
      const listed = await asAdmin(
        request(server()).get("/waitlist/admin/email-templates"),
      ).expect(200);
      expect(listed.body).toContainEqual(
        expect.objectContaining({
          id: created.body.id,
          subject: "Hello #{name}",
        }),
      );

      await asAdmin(
        request(server()).delete(
          `/waitlist/admin/email-templates/${created.body.id}`,
        ),
      ).expect(204);
      await asAdmin(
        request(server()).delete(
          `/waitlist/admin/email-templates/${created.body.id}`,
        ),
      ).expect(404);
    });

    it("refuses a name another template has, in any case", async () => {
      const name = `Taken ${Math.random()}`;
      await asAdmin(request(server()).post("/waitlist/admin/email-templates"))
        .send(template({ name }))
        .expect(201);
      await asAdmin(request(server()).post("/waitlist/admin/email-templates"))
        .send(template({ name: name.toUpperCase() }))
        .expect(409);

      const other = await asAdmin(
        request(server()).post("/waitlist/admin/email-templates"),
      )
        .send(template())
        .expect(201);
      await asAdmin(
        request(server()).put(
          `/waitlist/admin/email-templates/${other.body.id}`,
        ),
      )
        .send(template({ name: name.toLowerCase() }))
        .expect(409);
      await asAdmin(
        request(server()).put(
          `/waitlist/admin/email-templates/${other.body.id}`,
        ),
      )
        .send(template({ name: other.body.name.toUpperCase() }))
        .expect(200);
    });

    it("answers 404 for a template that doesn't exist", async () => {
      await asAdmin(
        request(server()).put("/waitlist/admin/email-templates/999999999"),
      )
        .send(template())
        .expect(404);
    });

    it("refuses a blank body", async () => {
      const res = await asAdmin(
        request(server()).post("/waitlist/admin/email-templates"),
      )
        .send(template({ body: "  \n " }))
        .expect(400);
      expect(res.body.message).toEqual(["body should not be blank"]);
    });

    it("refuses unknown placeholders in the subject or body", async () => {
      const res = await asAdmin(
        request(server()).post("/waitlist/admin/email-templates"),
      )
        .send(template({ subject: "Hi #{firstname}", body: "#{link|links}" }))
        .expect(400);
      expect(res.body.message).toEqual([
        "subject has unknown placeholders: #{firstname}",
        "body has unknown placeholders: #{link|links}",
      ]);
    });
  });
});
