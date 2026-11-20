import { randomUUID } from "crypto";
import { MmsDirection } from "src/mms/mms.entity";
import supertest from "supertest";
import { TWILIO_NUMBER } from "./mms-fixtures";
import { mmsThreadApp } from "./mms-thread-app";

const {
  mmsRepo,
  server,
  admin,
  inbound,
  send,
  sendInThread,
  threadIdFor,
  createMember,
  saveBroadcast,
} = mmsThreadApp();

const list = async (query: Record<string, string> = {}) =>
  (
    await supertest(server())
      .get("/mms-threads")
      .query(query)
      .set("Authorization", admin())
      .expect(200)
  ).body;

describe("Thread list (e2e)", () => {
  it("lists numbers with an inbound or staff text, newest first", async () => {
    const member = await createMember("+14155558811");
    await inbound({ from: "+14155558812", body: "Stranger" }).expect(201);
    await inbound({ from: "+14155558811", body: "Member" }).expect(201);
    await saveBroadcast("+14155558813");

    const { threads } = await list({ search: "415555881" });

    expect(threads.map((t: { phoneNumber: string }) => t.phoneNumber)).toEqual([
      "+14155558811",
      "+14155558812",
    ]);
    expect(threads[0]).toMatchObject({
      members: [{ id: member.id }],
      lastMessageBody: "Member",
      lastMessageDirection: "inbound",
    });
    expect(threads[1]).toMatchObject({ members: [] });
  });

  it("matches a search typed with punctuation", async () => {
    await inbound({ from: "+14155558804", body: "Hello" }).expect(201);

    const { threads } = await list({ search: "(415) 555-8804" });

    expect(threads).toEqual([
      expect.objectContaining({ phoneNumber: "+14155558804" }),
    ]);
  });

  it("lists a number staff texted and reports a staff reply as its latest text", async () => {
    const member = await createMember("+14155558821");
    await send(member.id, "Hello from the Alliance").expect(201);
    await inbound({ from: "+14155558822", body: "Question?" }).expect(201);
    const threadId = await threadIdFor("+14155558822");
    await sendInThread(threadId, "Answer").expect(201);

    const { threads } = await list({ search: "415555882" });

    expect(threads).toEqual([
      expect.objectContaining({
        phoneNumber: "+14155558822",
        lastMessageBody: "Answer",
        lastMessageDirection: "outbound",
      }),
      expect.objectContaining({
        phoneNumber: "+14155558821",
        lastMessageBody: "Hello from the Alliance",
      }),
    ]);
  });

  it("lists a number that opted out", async () => {
    await inbound({ from: "+14155558831", body: "Hello" }).expect(201);
    await inbound({ from: "+14155558831", body: "STOP" }).expect(201);

    const { threads } = await list({ search: "4155558831" });

    expect(threads).toEqual([
      expect.objectContaining({ phoneNumber: "+14155558831" }),
    ]);
  });

  it("refuses a search with no digits", async () => {
    await supertest(server())
      .get("/mms-threads")
      .query({ search: "Maria" })
      .set("Authorization", admin())
      .expect(400);
  });

  it("pages by the latest text, leaving the oldest for the next page", async () => {
    const numbers = ["+14159990000", "+14159990001", "+14159990002"];
    await mmsRepo().save(
      numbers.map((from, index) =>
        mmsRepo().create({
          from,
          to: TWILIO_NUMBER,
          direction: MmsDirection.Inbound,
          body: "Hello",
          status: "received",
          twilioSid: randomUUID(),
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        }),
      ),
    );
    const phoneNumbers = (page: { threads: { phoneNumber: string }[] }) =>
      page.threads.map((t) => t.phoneNumber);

    const first = await list({ search: "1415999", page: "1", limit: "2" });
    const second = await list({ search: "1415999", page: "2", limit: "2" });

    expect(phoneNumbers(first)).toEqual(numbers.slice(1).toReversed());
    expect(first.hasMore).toBe(true);
    expect(phoneNumbers(second)).toEqual([numbers[0]]);
    expect(second.hasMore).toBe(false);
  });
});
