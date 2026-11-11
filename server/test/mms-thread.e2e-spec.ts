import { randomUUID } from "crypto";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { MmsMedia } from "src/mms/mms-media.entity";
import { MmsMediaService } from "src/mms/mms-media.service";
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

const textsWith = (memberPhoneNumber: string) =>
  mmsRepo.find({ where: { memberPhoneNumber }, order: { id: "ASC" } });

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

describe("Inbound texts (e2e)", () => {
  it("records a reply under the member's number", async () => {
    await inbound({ from: "(415) 555-8001", body: "Count me in" }).expect(201);

    expect(await textsWith("+14155558001")).toEqual([
      expect.objectContaining({
        direction: MmsDirection.Inbound,
        from: "+14155558001",
        to: TWILIO_NUMBER,
        body: "Count me in",
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

    expect(await textsWith("+14155558009")).toEqual([
      expect.objectContaining({ direction: MmsDirection.Outbound }),
    ]);
  });

  it("records a webhook Twilio retries only once", async () => {
    const sid = randomUUID();
    await inbound({ from: "+14155558002", body: "hi", sid }).expect(201);
    await inbound({ from: "+14155558002", body: "hi", sid }).expect(201);

    expect(await textsWith("+14155558002")).toHaveLength(1);
  });

  it("records a STOP reply and still opts the member out", async () => {
    const member = await createMember("+14155558003");
    await inbound({ from: "+14155558003", body: "STOP" }).expect(201);

    expect(
      (await userRepo.findOneByOrFail({ id: member.id }))
        .phoneNumberUnsubscribed,
    ).toBe(true);
    expect(await textsWith("+14155558003")).toEqual([
      expect.objectContaining({ body: "STOP", keyword: MmsKeyword.Stop }),
    ]);
  });

  it("records a START reply as the keyword the webhook matched", async () => {
    await inbound({ from: "+14155558005", body: " yes\n" }).expect(201);

    expect(await textsWith("+14155558005")).toEqual([
      expect.objectContaining({ body: " yes\n", keyword: MmsKeyword.Start }),
    ]);
  });

  it("opts the member out even when the text can't be recorded", async () => {
    const member = await createMember("+14155558010");
    await supertest(server())
      .post("/mms/inbound")
      .type("form")
      .send({ From: "+14155558010", To: TWILIO_NUMBER, Body: "STOP" })
      .expect(500);

    expect(
      (await userRepo.findOneByOrFail({ id: member.id }))
        .phoneNumberUnsubscribed,
    ).toBe(true);
    expect(await textsWith("+14155558010")).toEqual([]);
  });

  it("ignores a text whose body isn't a string", async () => {
    await supertest(server())
      .post("/mms/inbound")
      .type("form")
      .send("From=%2B14155558011&To=%2B15555550100&Body[x]=hi&MessageSid=SM11")
      .expect(201);

    expect(await textsWith("+14155558011")).toEqual([]);
  });

  it("records MMS attachments as pending and starts copying them", async () => {
    copyToS3.mockClear();
    await inbound({
      from: "+14155558004",
      body: "",
      media: [{ url: MEDIA_URL, contentType: "image/jpeg" }],
    }).expect(201);

    const [message] = await textsWith("+14155558004");
    expect(
      await ctx.dataSource
        .getRepository(MmsMedia)
        .findBy({ mmsId: message.id }),
    ).toEqual([
      expect.objectContaining({
        twilioUrl: MEDIA_URL,
        contentType: "image/jpeg",
        s3Key: null,
      }),
    ]);
    expect(copyToS3).toHaveBeenCalledWith([
      expect.objectContaining({ twilioUrl: MEDIA_URL }),
    ]);
  });
});

describe("Inbound media URLs (e2e)", () => {
  const mediaOf = async (from: string) => {
    const [message] = await textsWith(from);
    return ctx.dataSource.getRepository(MmsMedia).findBy({ mmsId: message.id });
  };

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

    expect(await textsWith(from)).toEqual([
      expect.objectContaining({ body: "photo" }),
    ]);
    expect(await mediaOf(from)).toEqual([
      expect.objectContaining({
        twilioUrl: MEDIA_URL,
        contentType: "image/png",
      }),
    ]);
  });
});

describe("Staff text senders (e2e)", () => {
  it("keeps the sender of a staff text after their account is deleted", async () => {
    const staff = await createMember("+14155558601");
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

    await softDeleteCascade(ctx.dataSource.manager, {
      target: User,
      ids: [staff.id],
    });

    expect((await mmsRepo.findOneByOrFail({ id: text.id })).sentById).toBe(
      staff.id,
    );
  });
});
