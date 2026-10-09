import request from "supertest";
import type { Repository } from "typeorm";
import { WaitlistBrowser } from "../src/waitlist/entities/waitlist-browser.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistBrowserService } from "../src/waitlist/waitlist-browser.service";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist browser state (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let browserRepo: Repository<WaitlistBrowser>;

  const uniqueEmail = () => `browser-${Math.random()}@example.com`;

  const newBrowser = () => request.agent(ctx.app.getHttpServer());

  const join = (browser: ReturnType<typeof newBrowser>, email: string) =>
    browser
      .post("/waitlist/entries")
      .send({
        name: "Test Person",
        email,
        reason: "I want to help",
        committed: true,
      })
      .expect(200);

  const state = async (browser: ReturnType<typeof newBrowser>) =>
    (await browser.get("/waitlist/browser").expect(200)).body;

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    browserRepo = ctx.dataSource.getRepository(WaitlistBrowser);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("remembers a new entry's share link in an HttpOnly, strict session cookie", async () => {
    const browser = newBrowser();
    const res = await join(browser, uniqueEmail());

    const cookies = res.headers["set-cookie"] ?? [];
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/^waitlist_session=/);
    expect(cookies[0]).toContain("HttpOnly");
    expect(cookies[0]).toContain("SameSite=Strict");
    expect(cookies[0]).not.toMatch(/Max-Age|Expires/i);
    expect(await state(browser)).toEqual({
      entry: { shareCode: res.body.shareCode, mobilized: false },
    });
  });

  it("stores only a hash of the cookie's token", async () => {
    const browser = newBrowser();
    const email = uniqueEmail();
    const res = await join(browser, email);
    const token = /^waitlist_session=([^;]+)/.exec(
      res.headers["set-cookie"]?.[0] ?? "",
    )?.[1];
    const entry = await entryRepo.findOneByOrFail({ email });

    const rows = await browserRepo.findBy({ entryId: entry.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it("does not remember a browser that submits a known email", async () => {
    const email = uniqueEmail();
    await join(newBrowser(), email);
    const browser = newBrowser();

    const res = await join(browser, email);

    expect(res.headers["set-cookie"]).toBeUndefined();
    expect((await state(browser)).entry).toBeNull();
  });

  it("reports a mobilized entry without its invite", async () => {
    const browser = newBrowser();
    const email = uniqueEmail();
    await join(browser, email);
    await entryRepo.update({ email }, { mobilizedAt: new Date() });

    expect(await state(browser)).toMatchObject({
      entry: { mobilized: true },
    });
  });

  it("forgets an expired browser and clears its cookie", async () => {
    const browser = newBrowser();
    const email = uniqueEmail();
    await join(browser, email);
    const entry = await entryRepo.findOneByOrFail({ email });
    await browserRepo.update(
      { entryId: entry.id },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    const res = await browser.get("/waitlist/browser").expect(200);

    expect(res.body.entry).toBeNull();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^waitlist_session=;/);
  });

  it("does not restore an entry from the persistent cookies older clients were given, and expires them", async () => {
    const email = uniqueEmail();
    const joined = await join(newBrowser(), email);
    const token = /^waitlist_session=([^;]+)/.exec(
      joined.headers["set-cookie"]?.[0] ?? "",
    )?.[1];

    const res = await request(ctx.app.getHttpServer())
      .get("/waitlist/browser")
      .set("Cookie", [`waitlist_browser=${token}`, "remembered_invite=legacy"])
      .expect(200);

    expect(res.body).toEqual({ entry: null });
    const cleared = res.headers["set-cookie"] ?? [];
    expect(cleared).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^waitlist_browser=;/),
        expect.stringMatching(/^remembered_invite=;/),
      ]),
    );
    const entry = await entryRepo.findOneByOrFail({ email });
    expect(await browserRepo.countBy({ entryId: entry.id })).toBe(0);
  });

  it("expires a remembered invitation from a browser that never joined", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/waitlist/browser")
      .set("Cookie", ["remembered_invite=legacy"])
      .expect(200);

    expect(res.body).toEqual({ entry: null });
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^remembered_invite=;/)]),
    );
  });

  it("forgets a browser that holds only the persistent cookies older clients were given", async () => {
    const email = uniqueEmail();
    const joined = await join(newBrowser(), email);
    const token = /^waitlist_session=([^;]+)/.exec(
      joined.headers["set-cookie"]?.[0] ?? "",
    )?.[1];

    const res = await request(ctx.app.getHttpServer())
      .delete("/waitlist/browser")
      .set("Cookie", [`waitlist_browser=${token}`, "remembered_invite=legacy"])
      .expect(204);

    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^waitlist_browser=;/),
        expect.stringMatching(/^remembered_invite=;/),
      ]),
    );
    const entry = await entryRepo.findOneByOrFail({ email });
    expect(await browserRepo.countBy({ entryId: entry.id })).toBe(0);
  });

  it("deletes only expired browsers when pruning", async () => {
    const expiredEmail = uniqueEmail();
    const liveEmail = uniqueEmail();
    await join(newBrowser(), expiredEmail);
    await join(newBrowser(), liveEmail);
    const expired = await entryRepo.findOneByOrFail({ email: expiredEmail });
    const live = await entryRepo.findOneByOrFail({ email: liveEmail });
    await browserRepo.update(
      { entryId: expired.id },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    await ctx.app.get(WaitlistBrowserService).forgetExpired();

    expect(await browserRepo.countBy({ entryId: expired.id })).toBe(0);
    expect(await browserRepo.countBy({ entryId: live.id })).toBe(1);
  });

  it("forgets the session, keeping the entry", async () => {
    const browser = newBrowser();
    const email = uniqueEmail();
    await join(browser, email);
    const entry = await entryRepo.findOneByOrFail({ email });

    const res = await browser.delete("/waitlist/browser").expect(204);

    expect(res.headers["set-cookie"]?.[0]).toMatch(/^waitlist_session=;/);
    expect(await state(browser)).toEqual({ entry: null });
    expect(await browserRepo.countBy({ entryId: entry.id })).toBe(0);
    expect(await entryRepo.existsBy({ id: entry.id })).toBe(true);
  });
});
