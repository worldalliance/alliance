import request from "supertest";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import { CustomLinksModule } from "../src/custom-links/custom-links.module";
import { CustomLink } from "../src/custom-links/entities/custom-link.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistLink } from "../src/waitlist/entities/waitlist-link.entity";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, type TestContext } from "./e2e-test-utils";

describe("Custom links (e2e)", () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();
  const fields = {
    label: "Printed flyer",
    slug: "100k",
    destination: "/projects/democratic-grantmaking-26?link=flyer#join",
  };
  const create = (body = fields) =>
    request(server())
      .post("/custom-links")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);
  const list = () =>
    request(server())
      .get("/custom-links")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);
  const resolve = () => request(server()).post("/custom-links/resolve/100k");

  beforeAll(async () => {
    ctx = await createTestApp([CustomLinksModule, WaitlistModule]);
  }, 50000);
  beforeEach(async () => {
    await ctx.dataSource.getRepository(CustomLink).clear();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it("restricts management to admins but permits anonymous arrivals", async () => {
    const link = await create().expect(201);
    for (const token of ["", ctx.accessToken]) {
      await request(server())
        .get("/custom-links")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
      await request(server())
        .post("/custom-links")
        .set("Authorization", `Bearer ${token}`)
        .send(fields)
        .expect(401);
      await request(server())
        .patch(`/custom-links/${link.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ label: "Changed" })
        .expect(401);
      await request(server())
        .delete(`/custom-links/${link.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    }
    const arrival = await resolve().expect(200);
    expect(arrival.body).toEqual({ destination: fields.destination });
    expect(arrival.headers["cache-control"]).toBe("no-store");
  });

  it("counts concurrent arrivals without losing increments and retains counts across edits", async () => {
    const link = await create().expect(201);
    await Promise.all(Array.from({ length: 12 }, () => resolve().expect(200)));
    const updated = await request(server())
      .patch(`/custom-links/${link.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ destination: "https://example.com/join?ref=flyer" })
      .expect(200);
    expect(updated.body.visits).toBe(12);
    expect((await resolve().expect(200)).body.destination).toBe(
      "https://example.com/join?ref=flyer",
    );
    expect((await list().expect(200)).body[0].visits).toBe(13);
    await request(server())
      .delete(`/custom-links/${link.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    await resolve().expect(404);
    expect((await list().expect(200)).body).toEqual([]);
  });

  it("rejects duplicate paths, including edits, and normalizes an optional slash", async () => {
    await create().expect(201);
    await create({ ...fields, slug: " /100k " }).expect(409);
    const other = await create({ ...fields, slug: "another" }).expect(201);
    await request(server())
      .patch(`/custom-links/${other.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ slug: "100k" })
      .expect(409);
  });

  it.each([
    { slug: "join" },
    { slug: "api" },
    { slug: "bad/path" },
    { destination: "javascript:alert(1)" },
    { destination: "//evil.example" },
    { destination: "/100k" },
    { destination: "https://thealliance.org/100k" },
    { destination: null },
    { label: null },
    { slug: null },
    { label: " " },
  ])("rejects invalid create and update inputs %p", async (invalid) => {
    await request(server())
      .post("/custom-links")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ ...fields, ...invalid })
      .expect(400);
    const link = await create().expect(201);
    await request(server())
      .patch(`/custom-links/${link.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(invalid)
      .expect(400);
  });

  it("returns 404 for missing links and rejects empty updates", async () => {
    await resolve().expect(404);
    const link = await create().expect(201);
    await request(server())
      .patch(`/custom-links/${link.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({})
      .expect(400);
    await request(server())
      .patch("/custom-links/2147483647")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ label: "Missing" })
      .expect(404);
    await request(server())
      .delete("/custom-links/2147483647")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
  });

  it("preserves the organization waitlist link through signup", async () => {
    const organization = await ctx.dataSource.getRepository(Campaign).save({
      name: "Test Organization",
      code: "custom-link-test-org",
      kind: CampaignKind.Organization,
    });
    const waitlistLink = await ctx.dataSource.getRepository(WaitlistLink).save({
      organizationId: organization.id,
      channel: "Flyer",
      code: "flyer",
    });
    await create().expect(201);
    const arrival = await resolve().expect(200);
    const linkCode = new URL(
      arrival.body.destination,
      "https://site.test",
    ).searchParams.get("link");
    await request(server())
      .post("/waitlist/entries")
      .send({
        name: "Test Flyer Visitor",
        email: "custom-link-test@example.com",
        linkCode,
      })
      .expect(200);
    const entry = await ctx.dataSource
      .getRepository(WaitlistEntry)
      .findOneByOrFail({ email: "custom-link-test@example.com" });
    expect(entry.organizationId).toBe(organization.id);
    expect(entry.sourceLinkId).toBe(waitlistLink.id);
  });
});
