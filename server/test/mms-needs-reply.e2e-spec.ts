import { softDeleteCascade } from "src/datasources/soft-delete";
import {
  MmsThreadEvent,
  MmsThreadEventKind,
} from "src/mms/mms-thread-event.entity";
import { User } from "src/user/entities/user.entity";
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

const latestId = async (userId: number): Promise<number> =>
  (await thread(userId).expect(200)).body.messages.at(-1).id;

const markHandled = (userId: number, throughId: number) =>
  supertest(server())
    .post(`/mms-threads/${userId}/handled`)
    .set("Authorization", admin())
    .send({ throughId });

const markNeedsReply = (userId: number, throughId: number) =>
  supertest(server())
    .post(`/mms-threads/${userId}/needs-reply`)
    .set("Authorization", admin())
    .send({ throughId });

const threadEvents = async (userId: number) =>
  (await thread(userId).expect(200)).body.messages.flatMap(
    (message: { events: unknown[] }) => message.events,
  );

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

  describe("marking handled", () => {
    it("leaves a member out until they text again", async () => {
      const member = await createMember("+14155558230");
      await inbound({ from: "+14155558230", body: "Thanks!" });
      await markHandled(member.id, await latestId(member.id)).expect(204);
      expect(await needsReply()).not.toContain(member.id);

      await inbound({ from: "+14155558230", body: "One more thing" });
      const followUp = await mmsRepo().findOneByOrFail({
        memberPhoneNumber: "+14155558230",
        body: "One more thing",
      });
      expect(await needsReplyEntry(member.id)).toMatchObject({
        lastMessageBody: "One more thing",
        waitingSince: followUp.createdAt.toISOString(),
      });
      expect((await thread(member.id).expect(200)).body.replyState).toBe(
        "needs_reply",
      );
    });

    it("keeps a member listed for a text after the one staff saw", async () => {
      const member = await createMember("+14155558231");
      await inbound({ from: "+14155558231", body: "Thanks!" });
      const seen = await latestId(member.id);
      await inbound({ from: "+14155558231", body: "Wait, a question" });
      await markHandled(member.id, seen).expect(204);

      expect(await needsReplyEntry(member.id)).toMatchObject({
        lastMessageBody: "Wait, a question",
      });
      expect((await thread(member.id).expect(200)).body.replyState).toBe(
        "needs_reply",
      );
    });

    it("shows who marked the thread handled", async () => {
      const member = await createMember("+14155558232");
      await inbound({ from: "+14155558232", body: "Thanks!" });
      expect((await thread(member.id).expect(200)).body).toMatchObject({
        replyState: "needs_reply",
      });
      await markHandled(member.id, await latestId(member.id)).expect(204);

      const { body } = await thread(member.id).expect(200);
      expect(body.replyState).toBe("handled");
      expect(body.messages.at(-1).events).toEqual([
        {
          id: expect.any(Number),
          kind: "marked_handled",
          markedByName: expect.any(String),
          createdAt: expect.any(String),
        },
      ]);
    });

    it("keeps who marked the thread after their account is deleted", async () => {
      const staff = await createMember("+14155558239");
      const member = await createMember("+14155558240");
      await inbound({ from: "+14155558240", body: "Thanks!" });
      const events = ctx().dataSource.getRepository(MmsThreadEvent);
      const event = await events.save(
        events.create({
          kind: MmsThreadEventKind.MarkedHandled,
          afterMmsId: await latestId(member.id),
          markedById: staff.id,
        }),
      );

      await softDeleteCascade(ctx().dataSource.manager, {
        target: User,
        ids: [staff.id],
      });

      expect((await events.findOneByOrFail({ id: event.id })).markedById).toBe(
        staff.id,
      );
      expect(await threadEvents(member.id)).toEqual([
        expect.objectContaining({ markedByName: null }),
      ]);
    });

    it("keeps every marking and undo in the thread's history", async () => {
      const member = await createMember("+14155558237");
      await inbound({ from: "+14155558237", body: "Thanks!" });
      const seen = await latestId(member.id);
      await markHandled(member.id, seen).expect(204);
      await markNeedsReply(member.id, seen).expect(204);
      await markHandled(member.id, seen).expect(204);

      expect(
        (await threadEvents(member.id)).map((e: { kind: string }) => e.kind),
      ).toEqual(["marked_handled", "marked_needs_reply", "marked_handled"]);
    });

    it("lists the member again, waiting since their text, once marked needs reply", async () => {
      const member = await createMember("+14155558233");
      await inbound({ from: "+14155558233", body: "Question?" });
      const before = await needsReplyEntry(member.id);
      await markHandled(member.id, await latestId(member.id)).expect(204);
      await markNeedsReply(member.id, await latestId(member.id)).expect(204);

      expect(await needsReplyEntry(member.id)).toEqual(before);
      expect((await thread(member.id).expect(200)).body.replyState).toBe(
        "needs_reply",
      );
    });

    it("leaves texts a staff reply answered alone when marked needs reply", async () => {
      const member = await createMember("+14155558234");
      await inbound({ from: "+14155558234", body: "Thanks!" });
      await markHandled(member.id, await latestId(member.id)).expect(204);
      await send(member.id, "You're welcome").expect(201);
      await markNeedsReply(member.id, await latestId(member.id)).expect(204);

      expect(await needsReply()).not.toContain(member.id);
      expect((await thread(member.id).expect(200)).body.replyState).toBe(
        "answered",
      );
      expect(
        (await threadEvents(member.id)).map((e: { kind: string }) => e.kind),
      ).toEqual(["marked_handled"]);
    });

    it("records one event when a thread is marked several times at once", async () => {
      const member = await createMember("+14155558238");
      await inbound({ from: "+14155558238", body: "Thanks!" });
      await inbound({ from: "+14155558238", body: "Bye" });
      const seen = await latestId(member.id);
      const marks = [1, 2, 3, 4];
      await Promise.all(
        marks.map(() => markHandled(member.id, seen).expect(204)),
      );
      await Promise.all(
        marks.map(() => markNeedsReply(member.id, seen).expect(204)),
      );

      expect(
        (await threadEvents(member.id)).map((e: { kind: string }) => e.kind),
      ).toEqual(["marked_handled", "marked_needs_reply"]);
    });

    it("refuses a text from another member's thread", async () => {
      const member = await createMember("+14155558235");
      const other = await createMember("+14155558236");
      await inbound({ from: "+14155558235", body: "Question?" });
      await inbound({ from: "+14155558236", body: "Hi" });

      await markHandled(member.id, await latestId(other.id)).expect(400);
      expect(await needsReply()).toContain(member.id);
    });

    it("refuses an unknown member", async () => {
      await markHandled(2_000_000_000, 1).expect(404);
      await markNeedsReply(2_000_000_000, 1).expect(404);
    });
  });
});
