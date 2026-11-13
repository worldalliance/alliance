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
  send,
  createMember,
  saveBroadcast,
} = mmsThreadApp();

const needsReply = async (): Promise<number[]> =>
  (
    await supertest(server())
      .get("/mms-threads/needs-reply")
      .set("Authorization", admin())
      .expect(200)
  ).body.map((entry: { userId: number }) => entry.userId);

const needsReplyEntry = async (userId: number) =>
  (
    await supertest(server())
      .get("/mms-threads/needs-reply")
      .set("Authorization", admin())
      .expect(200)
  ).body.find((entry: { userId: number }) => entry.userId === userId);

describe("Needs reply (e2e)", () => {
  it("lists a member until a staff member replies", async () => {
    const member = await createMember("+14155558201");
    await inbound({ from: "+14155558201", body: "Question?" });
    expect(await needsReply()).toContain(member.id);

    await send(member.id, "Answer").expect(201);
    expect(await needsReply()).not.toContain(member.id);

    await inbound({ from: "+14155558201", body: "Follow-up" });
    expect(await needsReply()).toContain(member.id);
  });

  it("keeps a member listed when only a broadcast followed their text", async () => {
    const member = await createMember("+14155558202");
    await inbound({ from: "+14155558202", body: "Question?" });
    await saveBroadcast("+14155558202");

    expect(await needsReply()).toContain(member.id);
  });

  it.each([
    ["failed", "+14155558205"],
    ["undelivered", "+14155558216"],
    ["canceled", "+14155558217"],
  ] as const)(
    "keeps a member listed when the staff reply is %s",
    async (status, phoneNumber) => {
      const member = await createMember(phoneNumber);
      await inbound({ from: phoneNumber, body: "Question?" });
      const { body } = await send(member.id, "Answer").expect(201);
      await mmsRepo().update({ id: body.id }, { status });

      expect(await needsReply()).toContain(member.id);
    },
  );

  it("leaves out a member staff marked opted out", async () => {
    const member = await createMember("+14155558203");
    await inbound({ from: "+14155558203", body: "Please stop texting me" });
    await supertest(server())
      .post(`/mms-threads/${member.id}/opt-out`)
      .set("Authorization", admin())
      .expect(204);

    expect(await needsReply()).not.toContain(member.id);
  });

  it("leaves out a member whose latest text is a START keyword", async () => {
    const member = await createMember("+14155558211");
    await inbound({ from: "+14155558211", body: "\uFEFF yes\u00A0\u202F\n" });

    expect(await needsReply()).not.toContain(member.id);
  });

  it("keeps a member listed when a START keyword followed their text", async () => {
    const member = await createMember("+14155558212");
    await inbound({ from: "+14155558212", body: "Question?" });
    await inbound({ from: "+14155558212", body: "START" });

    expect(await needsReplyEntry(member.id)).toMatchObject({
      lastMessageBody: "Question?",
    });
  });

  it("leaves out a member who texted STOP, then START", async () => {
    const member = await createMember("+14155558214");
    await inbound({ from: "+14155558214", body: "STOP" });
    await inbound({ from: "+14155558214", body: "START" });

    expect(await needsReply()).not.toContain(member.id);
  });

  it("keeps a member listed when STOP, then START, followed their text", async () => {
    const member = await createMember("+14155558215");
    await inbound({ from: "+14155558215", body: "Question?" });
    await inbound({ from: "+14155558215", body: "STOP" });
    await inbound({ from: "+14155558215", body: "START" });

    expect(await needsReplyEntry(member.id)).toMatchObject({
      lastMessageBody: "Question?",
    });
  });

  it("lists a member who texted HELP", async () => {
    const member = await createMember("+14155558213");
    await inbound({ from: "+14155558213", body: "HELP" });

    expect(await needsReply()).toContain(member.id);
  });

  it("leaves out deleted members", async () => {
    const member = await createMember("+14155558206");
    await inbound({ from: "+14155558206", body: "Question?" });
    await userRepo().softDelete(member.id);

    expect(await needsReply()).not.toContain(member.id);
  });

  it("lists a member once when two of their texts share a timestamp", async () => {
    const member = await createMember("+14155558204");
    await ctx().dataSource.query(
      `INSERT INTO "mms" ("to", "from", "body", "status", "twilioSid", "direction", "createdAt")
       SELECT $1, $2, 'hi', 'received', gen_random_uuid()::text, 'inbound', now()
       FROM generate_series(1, 2)`,
      [TWILIO_NUMBER, "+14155558204"],
    );

    expect((await needsReply()).filter((id) => id === member.id)).toEqual([
      member.id,
    ]);
  });

  it("keeps a member listed when their text arrived while a staff text was sending", async () => {
    const member = await createMember("+14155558219");
    await inbound({ from: "+14155558219", body: "Question?" });
    const question = await mmsRepo().findOneByOrFail({
      memberPhoneNumber: "+14155558219",
    });
    const { body } = await send(member.id, "Answer").expect(201);
    await mmsRepo().update(
      { id: body.id },
      { createdAt: new Date(question.createdAt.getTime() - 1000) },
    );

    expect(await needsReply()).toContain(member.id);
  });

  it("orders a staff text after a member text with the same timestamp by id", async () => {
    const member = await createMember("+14155558220");
    await inbound({ from: "+14155558220", body: "Question?" });
    const question = await mmsRepo().findOneByOrFail({
      memberPhoneNumber: "+14155558220",
    });
    const { body } = await send(member.id, "Answer").expect(201);
    await ctx().dataSource.query(
      `UPDATE "mms" SET "createdAt" = (SELECT "createdAt" FROM "mms" WHERE id = $1) WHERE id = $2`,
      [question.id, body.id],
    );

    expect(await needsReply()).not.toContain(member.id);
  });

  it("lists the member who has waited longest first", async () => {
    const longer = await createMember("+14155558208");
    const shorter = await createMember("+14155558209");
    await inbound({ from: "+14155558208", body: "First" });
    await inbound({ from: "+14155558209", body: "Second" });
    await inbound({ from: "+14155558208", body: "Third" });

    expect(
      (await needsReply()).filter((id) => [longer.id, shorter.id].includes(id)),
    ).toEqual([longer.id, shorter.id]);
  });

  it("times the wait from the oldest unanswered text and shows the latest", async () => {
    const member = await createMember("+14155558218");
    await inbound({ from: "+14155558218", body: "Answered" });
    await send(member.id, "Answer").expect(201);
    await inbound({ from: "+14155558218", body: "Question?" });
    await inbound({ from: "+14155558218", body: "Hello?" });
    const question = await mmsRepo().findOneByOrFail({
      memberPhoneNumber: "+14155558218",
      body: "Question?",
    });

    expect(await needsReplyEntry(member.id)).toEqual({
      userId: member.id,
      name: member.name,
      lastMessageBody: "Hello?",
      waitingSince: question.createdAt.toISOString(),
    });
  });

  it("lists each member who shares the number", async () => {
    const first = await createMember("+14155558210");
    const second = await createMember("+14155558210");
    await inbound({ from: "+14155558210", body: "Question?" });

    expect(
      (await needsReply()).filter((id) => [first.id, second.id].includes(id)),
    ).toEqual([first.id, second.id]);
  });
});
