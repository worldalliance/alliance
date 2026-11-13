import { R } from "@alliance/common/result";
import { setEnv } from "@alliance/common/set-env";
import { STAFF_TEXT_MAX_LENGTH } from "@alliance/common/staffText";
import { randomUUID } from "crypto";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { EventLogService } from "src/eventlog/eventlog.service";
import { MmsMediaStatus } from "src/mms/mms-media.service";
import { MmsOptout } from "src/mms/mms-optout.entity";
import { THREAD_PAGE_SIZE } from "src/mms/mms-thread.service";
import { MmsDirection, MmsKeyword } from "src/mms/mms.entity";
import { MmsService, StaffSendFailureKind } from "src/mms/mms.service";
import { User } from "src/user/entities/user.entity";
import supertest from "supertest";
import { MEDIA_URL, TWILIO_NUMBER } from "./mms-fixtures";
import { mmsThreadApp } from "./mms-thread-app";

const {
  ctx,
  copyToS3,
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
      await mmsRepo().findBy({
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
    await ctx().dataSource.query(
      `INSERT INTO "mms" ("to", "from", "body", "status", "twilioSid") VALUES ($1, $2, 'hi', 'sent', 'test-sid')`,
      ["+14155558009", TWILIO_NUMBER],
    );

    expect(
      await mmsRepo().findBy({ memberPhoneNumber: "+14155558009" }),
    ).toEqual([expect.objectContaining({ direction: MmsDirection.Outbound })]);
  });

  it("orders texts sent at the same moment, and their attachments, by id", async () => {
    const member = await createMember("+14155558012");
    const nextIds = async (table: string, count: number): Promise<number[]> => {
      const rows: { id: string }[] = await ctx().dataSource.query(
        `SELECT nextval(pg_get_serial_sequence($1, 'id')) AS id FROM generate_series(1, $2)`,
        [table, count],
      );
      return rows.map((row) => Number(row.id));
    };
    const [firstText, secondText] = await nextIds("mms", 2);
    for (const id of [secondText, firstText]) {
      await ctx().dataSource.query(
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
      await ctx().dataSource.query(
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
    await ctx().dataSource.query(
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
    await ctx().dataSource.query(
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
    expect(
      await mmsRepo().findBy({ memberPhoneNumber: "+14155558003" }),
    ).toEqual([expect.objectContaining({ keyword: MmsKeyword.Stop })]);
  });

  it("records a START reply as the keyword the webhook matched", async () => {
    await inbound({ from: "+14155558005", body: " yes\n" }).expect(201);

    expect(
      await mmsRepo().findBy({ memberPhoneNumber: "+14155558005" }),
    ).toEqual([
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

    const { body } = await thread(member.id);
    expect(body.optedOut).toBe(true);
    expect(body.messages).toEqual([]);
  });

  it("ignores a text whose body isn't a string", async () => {
    const member = await createMember("+14155558011");
    await supertest(server())
      .post("/mms/inbound")
      .type("form")
      .send(
        `From=%2B14155558011&To=${encodeURIComponent(TWILIO_NUMBER)}&Body[x]=hi&MessageSid=SM11`,
      )
      .expect(201);

    expect((await thread(member.id)).body.messages).toEqual([]);
  });

  it("records MMS attachments as pending and starts copying them", async () => {
    const member = await createMember("+14155558004");
    copyToS3().mockClear();
    await inbound({
      from: "+14155558004",
      body: "",
      media: [
        { url: MEDIA_URL, contentType: "image/jpeg" },
        { url: MEDIA_URL, contentType: "video/mp4" },
      ],
    }).expect(201);

    const [message] = (await thread(member.id)).body.messages;
    expect(message.media).toEqual([
      expect.objectContaining({
        contentType: "image/jpeg",
        status: MmsMediaStatus.Copying,
        inline: true,
      }),
      expect.objectContaining({ contentType: "video/mp4", inline: false }),
    ]);
    expect(copyToS3()).toHaveBeenCalledWith([
      expect.objectContaining({ twilioUrl: MEDIA_URL }),
      expect.objectContaining({ twilioUrl: MEDIA_URL }),
    ]);
  });

  it("refuses non-admins", async () => {
    const member = await createMember("+14155558104");
    await supertest(server())
      .get(`/mms-threads/${member.id}`)
      .set("Authorization", `Bearer ${ctx().accessToken}`)
      .expect(401);
  });

  it("shows an empty thread for a member with no phone number", async () => {
    const member = await createMember(null);
    expect((await thread(member.id).expect(200)).body).toEqual({
      phoneNumber: null,
      textable: false,
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

describe("Staff texts (e2e)", () => {
  it("sends from the thread and names the staff member", async () => {
    const member = await createMember("+14155558101");

    const { body } = await send(member.id, "Hi from the team").expect(201);

    expect(body).toMatchObject({
      direction: MmsDirection.Outbound,
      body: "Hi from the team",
      sentByStaff: true,
      sentByName: expect.any(String),
    });
    const row = await mmsRepo().findOneByOrFail({ id: body.id });
    expect(row.sentById).toBe(ctx().adminUserId);
    expect(row.memberPhoneNumber).toBe("+14155558101");
  });

  it("passes on Twilio's reason when it rejects a text", async () => {
    const member = await createMember("+14155558106");
    const sendStaffText = jest
      .spyOn(ctx().app.get(MmsService), "sendStaffText")
      .mockResolvedValueOnce(
        R.failure({
          kind: StaffSendFailureKind.Rejected,
          reason: "this number is not a mobile number",
        }),
      );

    const { body } = await send(member.id, "Hello?").expect(422);

    expect(body.message).toBe("this number is not a mobile number");
    sendStaffText.mockRestore();
  });

  it("reports a send Twilio didn't answer in time as a timeout", async () => {
    const member = await createMember("+14155558107");
    const sendStaffText = jest
      .spyOn(ctx().app.get(MmsService), "sendStaffText")
      .mockResolvedValueOnce(
        R.failure({ kind: StaffSendFailureKind.TimedOut }),
      );

    await send(member.id, "Hello?").expect(504);
    sendStaffText.mockRestore();
  });

  it("reports a send that failed for any other reason as a bad gateway", async () => {
    const member = await createMember("+14155558108");
    const sendStaffText = jest
      .spyOn(ctx().app.get(MmsService), "sendStaffText")
      .mockResolvedValueOnce(R.failure({ kind: StaffSendFailureKind.Failed }));

    await send(member.id, "Hello?").expect(502);
    sendStaffText.mockRestore();
  });

  it("refuses to text an opted-out member", async () => {
    const member = await createMember("+14155558102");
    await userRepo().update(member.id, { phoneNumberUnsubscribed: true });

    await send(member.id, "Hello?").expect(409);
    expect(await mmsRepo().countBy({ memberPhoneNumber: "+14155558102" })).toBe(
      0,
    );
    expect((await thread(member.id)).body).toMatchObject({
      textable: true,
      optedOut: true,
    });
  });

  it("is not found for an unknown member", async () => {
    await send(2_000_000_000, "Hello?").expect(404);
  });

  it("refuses a member with no phone number", async () => {
    const member = await createMember(null);
    await send(member.id, "Hello?").expect(400);
  });

  it("refuses a member whose phone number isn't valid", async () => {
    const member = await createMember("12345");
    expect(member.phoneNumber).toBe("12345");

    const { body } = await send(member.id, "Hello?").expect(400);

    expect(body.message).toBe("This member's phone number isn't valid.");
    expect((await thread(member.id)).body.textable).toBe(false);
  });

  it("accepts a staging member's anonymized number outside production", async () => {
    const member = await createMember("+15550000123");

    const { body } = await send(member.id, "Hello?").expect(201);

    expect(body).toMatchObject({ body: "Hello?", status: "sent" });
    expect((await thread(member.id)).body.textable).toBe(true);
  });

  it("refuses an anonymized-looking number in production", async () => {
    const member = await createMember("+15550000124");
    const nodeEnv = process.env.NODE_ENV;
    setEnv("NODE_ENV", "production");
    try {
      await send(member.id, "Hello?").expect(400);
      expect((await thread(member.id)).body.textable).toBe(false);
    } finally {
      setEnv("NODE_ENV", nodeEnv);
    }
  });

  it("refuses an empty or blank text", async () => {
    const member = await createMember("+14155558103");
    await send(member.id, "").expect(400);
    await send(member.id, " \n ").expect(400);
    expect(await mmsRepo().countBy({ memberPhoneNumber: "+14155558103" })).toBe(
      0,
    );
  });

  it("refuses a text over the length limit", async () => {
    const member = await createMember("+14155558113");
    await send(member.id, "a".repeat(STAFF_TEXT_MAX_LENGTH + 1)).expect(400);
    await send(member.id, "a".repeat(STAFF_TEXT_MAX_LENGTH)).expect(201);
  });

  it("counts an emoji toward the length limit as two characters", async () => {
    const member = await createMember("+14155558114");
    await send(member.id, "😎".repeat(STAFF_TEXT_MAX_LENGTH / 2 + 1)).expect(
      400,
    );
    await send(member.id, "😎".repeat(STAFF_TEXT_MAX_LENGTH / 2)).expect(201);
  });
});

describe("Staff opt-outs (e2e)", () => {
  it("is not found for an unknown member", async () => {
    await supertest(server())
      .post("/mms-threads/2000000000/opt-out")
      .set("Authorization", admin())
      .expect(404);
  });

  it("marks a member opted out through the STOP path", async () => {
    const member = await createMember("+14155558105");
    const logged = jest.spyOn(ctx().app.get(EventLogService), "sendMessage");

    await supertest(server())
      .post(`/mms-threads/${member.id}/opt-out`)
      .set("Authorization", admin())
      .expect(204);

    expect(
      (await userRepo().findOneByOrFail({ id: member.id }))
        .phoneNumberUnsubscribed,
    ).toBe(true);
    const optout = await ctx()
      .dataSource.getRepository(MmsOptout)
      .findOneByOrFail({ user: { id: member.id } });
    expect(optout.reason).toBe(`marked_by_staff:${ctx().adminUserId}`);
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Texter unsubscribed from SMS (marked_by_staff:${ctx().adminUserId})`,
        userId: member.id,
      }),
    );
    logged.mockRestore();
  });

  it("refuses a member with no phone number", async () => {
    const member = await createMember(null);
    await supertest(server())
      .post(`/mms-threads/${member.id}/opt-out`)
      .set("Authorization", admin())
      .expect(400);
  });

  it("refuses a member whose stored number isn't normalized", async () => {
    const member = await createMember("+14155558120");
    await ctx().dataSource.query(
      `UPDATE "user" SET "phoneNumber" = '(415) 555-8120' WHERE id = $1`,
      [member.id],
    );
    await supertest(server())
      .post(`/mms-threads/${member.id}/opt-out`)
      .set("Authorization", admin())
      .expect(400);
    const stored = await userRepo().findOneByOrFail({ id: member.id });
    expect(stored.phoneNumberUnsubscribed).toBe(false);
  });

  it("refuses a member who has already opted out", async () => {
    const member = await createMember("+14155558109");
    await userRepo().update(member.id, { phoneNumberUnsubscribed: true });

    await supertest(server())
      .post(`/mms-threads/${member.id}/opt-out`)
      .set("Authorization", admin())
      .expect(409);
    expect(
      await ctx()
        .dataSource.getRepository(MmsOptout)
        .countBy({ user: { id: member.id } }),
    ).toBe(0);
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
      await mmsRepo().find({
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
    const text = await mmsRepo().save(
      mmsRepo().create({
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

    await softDeleteCascade(ctx().dataSource.manager, {
      target: User,
      ids: [staff.id],
    });

    expect((await mmsRepo().findOneByOrFail({ id: text.id })).sentById).toBe(
      staff.id,
    );
    expect((await thread(member.id)).body.messages).toEqual([
      expect.objectContaining({ sentByStaff: true, sentByName: null }),
    ]);
  });
});
