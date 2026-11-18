import { subDays } from "date-fns";
import { MmsNumberService } from "src/mms/mms-number.service";
import { MmsOptout } from "src/mms/mms-optout.entity";
import { MmsThread } from "src/mms/mms-thread.entity";
import { THREAD_PAGE_SIZE } from "src/mms/mms-thread.service";
import { MmsDirection } from "src/mms/mms.entity";
import supertest from "supertest";
import { TWILIO_NUMBER } from "./mms-fixtures";
import { mmsThreadApp } from "./mms-thread-app";

const {
  ctx,
  mmsRepo,
  userRepo,
  server,
  admin,
  inbound,
  thread,
  send,
  byId,
  numberThread,
  sendInThread,
  threadIdFor,
  createMember,
  saveBroadcast,
} = mmsThreadApp();

const threadRow = (phoneNumber: string) =>
  ctx().dataSource.getRepository(MmsThread).findOneBy({ phoneNumber });

const post = (path: string) =>
  supertest(server()).post(path).set("Authorization", admin());

describe("Thread rows (e2e)", () => {
  it("records a row for a number that texts in and for one staff text", async () => {
    await inbound({ from: "+14155558740", body: "Hi" }).expect(201);
    const member = await createMember("+14155558741");
    await send(member.id, "Hello").expect(201);

    expect(await threadRow("+14155558740")).not.toBeNull();
    expect(await threadRow("+14155558741")).not.toBeNull();
  });

  it("returns a number's existing row and bumps it on an inbound text", async () => {
    const numbers = ctx().app.get(MmsNumberService);
    const row = () =>
      ctx()
        .dataSource.getRepository(MmsThread)
        .findOneByOrFail({ phoneNumber: "+14155558742" });
    const id = await numbers.ensureThread("+14155558742");
    const created = await row();
    await inbound({ from: "+14155558742", body: "Hi" }).expect(201);

    expect(await numbers.ensureThread("+14155558742")).toBe(id);
    expect((await row()).updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime(),
    );
  });
});

describe("Number threads (e2e)", () => {
  it("names the members on the number", async () => {
    const member = await createMember("+14155558702");
    await inbound({ from: "+14155558702", body: "Hi" });
    const threadId = await threadIdFor("+14155558702");

    expect((await numberThread(threadId).expect(200)).body.members).toEqual([
      { id: member.id, name: member.name, timeZone: null },
    ]);
  });

  it("returns the number's thread id with a member's thread", async () => {
    const member = await createMember("+14155558716");
    await inbound({ from: "+14155558716", body: "Hi" });
    const threadId = await threadIdFor("+14155558716");

    expect((await thread(member.id).expect(200)).body.threadId).toBe(threadId);
  });

  it("lets staff reply to a non-member who texted in the last 30 days", async () => {
    await inbound({ from: "+14155558709", body: "Who is this?" });
    const threadId = await threadIdFor("+14155558709");

    expect((await numberThread(threadId).expect(200)).body).toMatchObject({
      members: [],
      replyWindowClosed: false,
    });
    await sendInThread(threadId, "The Alliance").expect(201);
  });

  it("refuses a reply to a non-member who hasn't texted in 30 days", async () => {
    await inbound({ from: "+14155558703", body: "Old question" });
    await mmsRepo().update(
      { memberPhoneNumber: "+14155558703" },
      { createdAt: subDays(new Date(), 31) },
    );
    const threadId = await threadIdFor("+14155558703");

    expect((await numberThread(threadId).expect(200)).body).toMatchObject({
      replyWindowClosed: true,
    });
    const { body } = await sendInThread(threadId, "Sorry for the wait").expect(
      409,
    );
    expect(body.message).toMatch(/hasn't texted in the last 30 days/);
  });

  it("refuses a reply to an opted-out non-member past the window as opted out", async () => {
    await inbound({ from: "+14155558790", body: "Question?" });
    await inbound({ from: "+14155558790", body: "STOP" });
    await mmsRepo().update(
      { memberPhoneNumber: "+14155558790" },
      { createdAt: subDays(new Date(), 31) },
    );
    const threadId = await threadIdFor("+14155558790");

    const { body } = await sendInThread(threadId, "Hello").expect(409);
    expect(body.message).toBe("This number has opted out of texts.");
  });

  it("keeps the window closed after a staff text, which only inbound texts open", async () => {
    await inbound({ from: "+14155558750", body: "Old question" });
    const threadId = await threadIdFor("+14155558750");
    await sendInThread(threadId, "Thanks for asking").expect(201);
    await mmsRepo().update(
      { memberPhoneNumber: "+14155558750", direction: MmsDirection.Inbound },
      { createdAt: subDays(new Date(), 31) },
    );

    expect((await numberThread(threadId).expect(200)).body).toMatchObject({
      replyWindowClosed: true,
    });
    await sendInThread(threadId, "Following up").expect(409);
  });

  it("lets staff reply to a member however long ago they texted", async () => {
    await createMember("+14155558704");
    await inbound({ from: "+14155558704", body: "Old question" });
    await mmsRepo().update(
      { memberPhoneNumber: "+14155558704" },
      { createdAt: subDays(new Date(), 90) },
    );
    const threadId = await threadIdFor("+14155558704");

    expect((await numberThread(threadId).expect(200)).body).toMatchObject({
      replyWindowClosed: false,
    });
    await sendInThread(threadId, "Sorry for the wait").expect(201);
  });

  it("holds a number whose only member deleted their account to the window", async () => {
    const member = await createMember("+14155558714");
    await inbound({ from: "+14155558714", body: "Old question" });
    await mmsRepo().update(
      { memberPhoneNumber: "+14155558714" },
      { createdAt: subDays(new Date(), 31) },
    );
    await userRepo().softDelete(member.id);
    const threadId = await threadIdFor("+14155558714");

    expect((await numberThread(threadId).expect(200)).body).toMatchObject({
      members: [],
      replyWindowClosed: true,
    });
    await sendInThread(threadId, "Sorry for the wait").expect(409);
  });

  it("opts out a non-member who texts STOP, refusing staff texts", async () => {
    await inbound({ from: "+14155558706", body: "Question?" });
    await inbound({ from: "+14155558706", body: "STOP" });
    const threadId = await threadIdFor("+14155558706");

    expect((await numberThread(threadId).expect(200)).body.optedOut).toBe(true);
    await sendInThread(threadId, "Hello").expect(409);
  });

  it("records a staff opt-out of a non-member's number with no member", async () => {
    await inbound({ from: "+14155558707", body: "Please stop texting me" });
    const threadId = await threadIdFor("+14155558707");

    await post(byId(threadId, "/opt-out")).expect(204);

    expect((await numberThread(threadId).expect(200)).body.optedOut).toBe(true);
    expect(
      await ctx()
        .dataSource.getRepository(MmsOptout)
        .find({
          where: { phoneNumber: "+14155558707" },
          relations: { user: true },
        }),
    ).toEqual([
      expect.objectContaining({
        user: null,
        reason: expect.stringMatching(/^marked_by_staff:/),
      }),
    ]);
  });

  it("records a staff opt-out of a non-member that hasn't texted in 30 days", async () => {
    await inbound({ from: "+14155558751", body: "Old question" });
    await mmsRepo().update(
      { memberPhoneNumber: "+14155558751" },
      { createdAt: subDays(new Date(), 31) },
    );
    const threadId = await threadIdFor("+14155558751");

    await post(byId(threadId, "/opt-out")).expect(204);

    expect((await numberThread(threadId).expect(200)).body.optedOut).toBe(true);
    await post(byId(threadId, "/opt-out")).expect(409);
  });

  it("treats a number as opted out while only a member's old flag says so", async () => {
    const member = await createMember("+14155558708");
    await userRepo().update(
      { id: member.id },
      { phoneNumberUnsubscribed: true },
    );
    await inbound({ from: "+14155558708", body: "Question?" });
    const threadId = await threadIdFor("+14155558708");

    expect((await numberThread(threadId).expect(200)).body.optedOut).toBe(true);
    await sendInThread(threadId, "Hello").expect(409);
  });

  it("answers 404 for an unknown thread and 400 for a malformed id", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    await numberThread(unknown).expect(404);
    await sendInThread(unknown, "Hi").expect(404);
    await post(byId(unknown, "/opt-out")).expect(404);
    await numberThread("not-a-uuid").expect(400);
  });

  it("pages a number's thread back from the newest text", async () => {
    await inbound({ from: "+14155558717", body: "First" }).expect(201);
    await ctx().dataSource.query(
      `INSERT INTO "mms" ("to", "from", "body", "status", "twilioSid")
       SELECT $1, $2, 'text ' || n, 'sent', 'test-sid' FROM generate_series(1, $3) n`,
      ["+14155558717", TWILIO_NUMBER, THREAD_PAGE_SIZE],
    );
    const threadId = await threadIdFor("+14155558717");

    const newest = (await numberThread(threadId).expect(200)).body;
    expect(newest.hasOlder).toBe(true);
    const older = (
      await numberThread(threadId)
        .query({ before: newest.messages[0].id })
        .expect(200)
    ).body;
    expect(older.hasOlder).toBe(false);
    expect(older.messages.map((m: { body: string }) => m.body)).toEqual([
      "First",
    ]);

    const elsewhere = await saveBroadcast("+14155558718");
    await numberThread(threadId).query({ before: elsewhere.id }).expect(400);
  });

  it("refuses staff texts to a short code", async () => {
    await inbound({ from: "72345", body: "Your code is 1234" });
    const threadId = await threadIdFor("72345");

    expect((await numberThread(threadId).expect(200)).body.textable).toBe(
      false,
    );
    await sendInThread(threadId, "Hi").expect(400);
    await post(byId(threadId, "/opt-out")).expect(400);
  });
});
