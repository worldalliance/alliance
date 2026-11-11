import { randomUUID } from "crypto";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { MmsMediaService, MmsMediaStatus } from "src/mms/mms-media.service";
import { THREAD_PAGE_SIZE } from "src/mms/mms-thread.service";
import { Mms, MmsDirection, MmsKeyword } from "src/mms/mms.entity";
import { MmsModule } from "src/mms/mms.module";
import { ReferralSource, User } from "src/user/entities/user.entity";
import supertest from "supertest";
import type { Repository } from "typeorm";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

const TWILIO_NUMBER = "+15555550100";
const MEDIA_URL =
  "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123";

let ctx: TestContext;
let mmsRepo: Repository<Mms>;
let userRepo: Repository<User>;
let mediaService: MmsMediaService;
let copyToS3: jest.SpyInstance;

const server = () => ctx.app.getHttpServer();
const admin = () => `Bearer ${ctx.adminAccessToken}`;

const inbound = (params: {
  from: string;
  body: string;
  sid?: string;
  media?: { url: string; contentType: string }[];
}) =>
  supertest(server())
    .post("/mms/inbound")
    .type("form")
    .send({
      From: params.from,
      To: TWILIO_NUMBER,
      Body: params.body,
      MessageSid: params.sid ?? randomUUID(),
      NumMedia: String(params.media?.length ?? 0),
      ...Object.fromEntries(
        (params.media ?? []).flatMap(({ url, contentType }, index) => [
          [`MediaUrl${index}`, url],
          [`MediaContentType${index}`, contentType],
        ]),
      ),
    });

const thread = (userId: number) =>
  supertest(server())
    .get(`/mms-threads/${userId}`)
    .set("Authorization", admin());

const createMember = (phoneNumber: string | null) =>
  userRepo.save(
    userRepo.create({
      email: `${randomUUID()}@example.com`,
      password: "pass",
      name: "Texter",
      referralSource: ReferralSource.None,
      phoneNumber,
    }),
  );

const saveBroadcast = (to: string) =>
  mmsRepo.save(
    mmsRepo.create({
      to,
      from: TWILIO_NUMBER,
      body: "New action live",
      status: "delivered",
      twilioSid: randomUUID(),
    }),
  );

beforeAll(async () => {
  ctx = await createTestApp([MmsModule]);
  mmsRepo = ctx.dataSource.getRepository(Mms);
  userRepo = ctx.dataSource.getRepository(User);
  mediaService = ctx.app.get(MmsMediaService);
  copyToS3 = jest.spyOn(mediaService, "copyToS3").mockResolvedValue();
}, 50000);

afterAll(async () => {
  await closeTestApp(ctx.app);
});

describe("Inbound texts in the member's thread (e2e)", () => {
  it("shows past broadcasts and replies in order, matched by phone number", async () => {
    const member = await createMember("+14155558001");
    await saveBroadcast("+14155558001");
    await inbound({ from: "(415) 555-8001", body: "Count me in" }).expect(201);

    const { body } = await thread(member.id).expect(200);

    expect(body.phoneNumber).toBe("+14155558001");
    expect(
      body.messages.map((m: { direction: string; body: string }) => [
        m.direction,
        m.body,
      ]),
    ).toEqual([
      [MmsDirection.Outbound, "New action live"],
      [MmsDirection.Inbound, "Count me in"],
    ]);
    expect(body.messages[0].sentByStaff).toBe(false);
    expect(
      await mmsRepo.findBy({
        memberPhoneNumber: "+14155558001",
        direction: MmsDirection.Inbound,
      }),
    ).toEqual([
      expect.objectContaining({
        to: TWILIO_NUMBER,
        status: "received",
        keyword: null,
      }),
    ]);
  });

  // BACKCOMPAT(mms-direction): goes with the direction column's default.
  it("files the previous release's texts, written without direction or member number, under their recipient", async () => {
    await ctx.dataSource.query(
      `INSERT INTO "mms" ("to", "from", "body", "status", "twilioSid") VALUES ($1, $2, 'hi', 'sent', 'test-sid')`,
      ["+14155558009", TWILIO_NUMBER],
    );

    expect(await mmsRepo.findBy({ memberPhoneNumber: "+14155558009" })).toEqual(
      [expect.objectContaining({ direction: MmsDirection.Outbound })],
    );
  });

  it("orders texts sent at the same moment, and their attachments, by id", async () => {
    const member = await createMember("+14155558012");
    const nextIds = async (table: string, count: number): Promise<number[]> => {
      const rows: { id: string }[] = await ctx.dataSource.query(
        `SELECT nextval(pg_get_serial_sequence($1, 'id')) AS id FROM generate_series(1, $2)`,
        [table, count],
      );
      return rows.map((row) => Number(row.id));
    };
    const [firstText, secondText] = await nextIds("mms", 2);
    for (const id of [secondText, firstText]) {
      await ctx.dataSource.query(
        `INSERT INTO "mms" ("id", "to", "from", "body", "status", "twilioSid", "createdAt") VALUES ($1, $2, $3, 'hi', 'sent', 'test-sid', '2026-01-01T00:00:00Z')`,
        [id, "+14155558012", TWILIO_NUMBER],
      );
    }
    const [secondTextMedia, firstMedia, secondMedia] = await nextIds(
      "mms_media",
      3,
    );
    for (const [id, mmsId] of [
      [secondMedia, firstText],
      [firstMedia, firstText],
      [secondTextMedia, secondText],
    ]) {
      await ctx.dataSource.query(
        `INSERT INTO "mms_media" ("id", "mmsId", "twilioUrl", "contentType") VALUES ($1, $2, $3, 'image/jpeg')`,
        [id, mmsId, MEDIA_URL],
      );
    }

    const { messages } = (await thread(member.id).expect(200)).body;

    expect(messages.map((m: { id: number }) => m.id)).toEqual([
      firstText,
      secondText,
    ]);
    expect(messages[0].media.map((m: { id: number }) => m.id)).toEqual([
      firstMedia,
      secondMedia,
    ]);
  });

  it("pages the thread from the newest text back, ties included", async () => {
    const member = await createMember("+14155558013");
    await ctx.dataSource.query(
      `INSERT INTO "mms" ("to", "from", "body", "status", "twilioSid", "createdAt")
       SELECT $1, $2, 'text ' || n, 'sent', 'test-sid', '2026-01-01'::timestamptz + greatest(n, 3) * interval '1 minute'
       FROM generate_series(1, 102) n`,
      ["+14155558013", TWILIO_NUMBER],
    );
    const bodies = (messages: { body: string }[]) =>
      messages.map((m) => m.body);

    const newest = (await thread(member.id).expect(200)).body;
    expect(newest.hasOlder).toBe(true);
    expect(bodies(newest.messages)).toEqual(
      Array.from({ length: 100 }, (_, i) => `text ${i + 3}`),
    );

    const older = (
      await thread(member.id)
        .query({ before: newest.messages[0].id })
        .expect(200)
    ).body;
    expect(older.hasOlder).toBe(false);
    expect(bodies(older.messages)).toEqual(["text 1", "text 2"]);

    const elsewhere = await saveBroadcast("+14155558014");
    await thread(member.id).query({ before: elsewhere.id }).expect(400);
    await thread(member.id).query({ before: 3_000_000_000 }).expect(400);
  });

  it("has no older texts when the thread is exactly one page", async () => {
    const member = await createMember("+14155558016");
    await ctx.dataSource.query(
      `INSERT INTO "mms" ("to", "from", "body", "status", "twilioSid")
       SELECT $1, $2, 'text ' || n, 'sent', 'test-sid' FROM generate_series(1, $3) n`,
      ["+14155558016", TWILIO_NUMBER, THREAD_PAGE_SIZE],
    );

    const { body } = await thread(member.id).expect(200);
    expect(body.messages).toHaveLength(THREAD_PAGE_SIZE);
    expect(body.hasOlder).toBe(false);
  });

  it("records a webhook Twilio retries only once", async () => {
    const member = await createMember("+14155558002");
    const sid = randomUUID();
    await inbound({ from: "+14155558002", body: "hi", sid }).expect(201);
    await inbound({ from: "+14155558002", body: "hi", sid }).expect(201);

    expect((await thread(member.id)).body.messages).toHaveLength(1);
  });

  it("records a STOP reply and still opts the member out", async () => {
    const member = await createMember("+14155558003");
    await inbound({ from: "+14155558003", body: "STOP" }).expect(201);

    const { body } = await thread(member.id);
    expect(body.optedOut).toBe(true);
    expect(body.messages.map((m: { body: string }) => m.body)).toEqual([
      "STOP",
    ]);
    expect(await mmsRepo.findBy({ memberPhoneNumber: "+14155558003" })).toEqual(
      [expect.objectContaining({ keyword: MmsKeyword.Stop })],
    );
  });

  it("records a START reply as the keyword the webhook matched", async () => {
    await inbound({ from: "+14155558005", body: " yes\n" }).expect(201);

    expect(await mmsRepo.findBy({ memberPhoneNumber: "+14155558005" })).toEqual(
      [expect.objectContaining({ body: " yes\n", keyword: MmsKeyword.Start })],
    );
  });

  it("opts the member out even when the text can't be recorded", async () => {
    const member = await createMember("+14155558010");
    await supertest(server())
      .post("/mms/inbound")
      .type("form")
      .send({ From: "+14155558010", To: TWILIO_NUMBER, Body: "STOP" })
      .expect(500);

    const { body } = await thread(member.id);
    expect(body.optedOut).toBe(true);
    expect(body.messages).toEqual([]);
  });

  it("ignores a text whose body isn't a string", async () => {
    const member = await createMember("+14155558011");
    await supertest(server())
      .post("/mms/inbound")
      .type("form")
      .send("From=%2B14155558011&To=%2B15555550100&Body[x]=hi&MessageSid=SM11")
      .expect(201);

    expect((await thread(member.id)).body.messages).toEqual([]);
  });

  it("records MMS attachments as pending and starts copying them", async () => {
    const member = await createMember("+14155558004");
    copyToS3.mockClear();
    await inbound({
      from: "+14155558004",
      body: "",
      media: [{ url: MEDIA_URL, contentType: "image/jpeg" }],
    }).expect(201);

    const [message] = (await thread(member.id)).body.messages;
    expect(message.media).toEqual([
      expect.objectContaining({
        contentType: "image/jpeg",
        status: MmsMediaStatus.Copying,
      }),
    ]);
    expect(copyToS3).toHaveBeenCalledWith([
      expect.objectContaining({ twilioUrl: MEDIA_URL }),
    ]);
  });

  it("refuses non-admins", async () => {
    const member = await createMember("+14155558104");
    await supertest(server())
      .get(`/mms-threads/${member.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(401);
  });

  it("shows an empty thread for a member with no phone number", async () => {
    const member = await createMember(null);
    expect((await thread(member.id).expect(200)).body).toEqual({
      phoneNumber: null,
      optedOut: false,
      messages: [],
      hasOlder: false,
    });
    const earlier = await saveBroadcast("+14155558015");
    await thread(member.id).query({ before: earlier.id }).expect(400);
  });

  it("is not found for an unknown member", async () => {
    await thread(2_000_000_000).expect(404);
  });
});

describe("Inbound media URLs (e2e)", () => {
  it.each([
    ["hosted anywhere but Twilio", "https://example.com/x.jpg", "+14155558501"],
    [
      "Twilio would serve without TLS",
      MEDIA_URL.replace("https:", "http:"),
      "+14155558502",
    ],
  ])("records the text but not media %s", async (_, url, from) => {
    await inbound({
      from,
      body: "photo",
      media: [
        { url, contentType: "image/jpeg" },
        { url: MEDIA_URL, contentType: "image/png" },
      ],
    }).expect(201);

    expect(
      await mmsRepo.find({
        where: { memberPhoneNumber: from },
        relations: { media: true },
      }),
    ).toEqual([
      expect.objectContaining({
        body: "photo",
        media: [
          expect.objectContaining({
            twilioUrl: MEDIA_URL,
            contentType: "image/png",
          }),
        ],
      }),
    ]);
  });
});

describe("Staff text senders (e2e)", () => {
  it("names the sender of a staff text, and keeps them after their account is deleted", async () => {
    const staff = await createMember("+14155558601");
    const member = await createMember("+14155558602");
    const text = await mmsRepo.save(
      mmsRepo.create({
        to: "+14155558602",
        from: TWILIO_NUMBER,
        body: "Hi from the team",
        status: "delivered",
        twilioSid: randomUUID(),
        sentById: staff.id,
      }),
    );
    expect((await thread(member.id)).body.messages).toEqual([
      expect.objectContaining({ sentByStaff: true, sentByName: staff.name }),
    ]);

    await softDeleteCascade(ctx.dataSource.manager, {
      target: User,
      ids: [staff.id],
    });

    expect((await mmsRepo.findOneByOrFail({ id: text.id })).sentById).toBe(
      staff.id,
    );
    expect((await thread(member.id)).body.messages).toEqual([
      expect.objectContaining({ sentByStaff: true, sentByName: null }),
    ]);
  });
});
