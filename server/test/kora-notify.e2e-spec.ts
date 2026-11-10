import {
  KORA_NOTIFY_NEEDS_ACTIVE,
  KORA_REVIEW_PATH,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { R } from "@alliance/common/result";
import { KoraParticipant } from "src/kora/entities/kora-participant.entity";
import { KoraNotice, KoraNotifyService } from "src/kora/kora-notify.service";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { DeliveryFailure } from "src/utils/notif-delivery";
import request from "supertest";
import {
  koraHarness,
  setKoraProjectStatus,
  type KoraHarness,
} from "./kora-fixtures";
import { forgetRateEvents } from "./otp-fixtures";

describe("Kora launch notice (e2e)", () => {
  let h: KoraHarness;
  let sent: { to: string; link: string }[];
  let failFor: Set<string>;

  const asAdmin = () =>
    request(h.ctx.app.getHttpServer())
      .post("/kora/admin/notify-waitlist")
      .set("Authorization", `Bearer ${h.ctx.adminAccessToken}`);
  const toNotify = async () =>
    (
      await request(h.ctx.app.getHttpServer())
        .get("/kora/admin/project")
        .set("Authorization", `Bearer ${h.ctx.adminAccessToken}`)
        .expect(200)
    ).body.toNotify;
  const settled = async () => {
    for (let i = 0; i < 50 && (await toNotify()) > failFor.size; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  const deliver = <T>(to: string, link: string, value: T) => {
    if (failFor.has(to)) return R.failure(DeliveryFailure.Failed);
    sent.push({ to, link });
    return R.success(value);
  };

  beforeAll(async () => {
    h = await koraHarness();
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
    await h.ctx.dataSource.getRepository(KoraParticipant).deleteAll();
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Active);
    sent = [];
    failFor = new Set();
    jest
      .spyOn(h.ctx.app.get(MailService), "sendUnrecordedMail")
      .mockImplementation(async ({ recipient, context }) =>
        deliver(recipient, String(context?.url), {
          messageId: "message-id",
        }),
      );
    jest
      .spyOn(h.ctx.app.get(MmsService), "sendUnrecordedText")
      .mockImplementation(async ({ to, body }) =>
        deliver(to, body, { sid: "sid" }),
      );
  });

  afterAll(async () => {
    await h.ctx.app.close();
  });

  it("refuses until the project is active, and sends nothing", async () => {
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Pending);
    const res = await asAdmin().expect(400);
    expect(res.body.message).toBe(KORA_NOTIFY_NEEDS_ACTIVE);
    expect(sent).toEqual([]);
  });

  it("sends each participant one message with the review link, by email or text", async () => {
    await seed({ email: "ada@example.org" }, { phoneNumber: "+15555550101" });

    const res = await asAdmin().expect(200);
    expect(res.body).toEqual({ queued: 2 });
    await settled();

    expect(sent.map((s) => s.to).sort()).toEqual([
      "+15555550101",
      "ada@example.org",
    ]);
    for (const s of sent) expect(s.link).toContain(KORA_REVIEW_PATH);
    expect(await toNotify()).toBe(0);

    await asAdmin().expect(200);
    await settled();
    expect(sent).toHaveLength(2);
  });

  it("reaches only people who joined since the last send", async () => {
    await seed({ email: "first@example.org" });
    await asAdmin().expect(200);
    await settled();
    await seed({ email: "later@example.org" });

    await asAdmin().expect(200);
    await settled();

    expect(sent.map((s) => s.to)).toEqual([
      "first@example.org",
      "later@example.org",
    ]);
  });

  it("leaves a failed delivery for the next send", async () => {
    await seed({ email: "flaky@example.org" }, { email: "fine@example.org" });
    failFor.add("flaky@example.org");

    await asAdmin().expect(200);
    await settled();
    expect(sent.map((s) => s.to)).toEqual(["fine@example.org"]);
    expect(await toNotify()).toBe(1);

    failFor.clear();
    await asAdmin().expect(200);
    await settled();
    expect(sent.map((s) => s.to)).toEqual([
      "fine@example.org",
      "flaky@example.org",
    ]);
  });

  it("never messages anyone twice when two sends run at once", async () => {
    await seed(
      ...Array.from({ length: 6 }, (_, i) => ({ email: `p${i}@example.org` })),
    );
    const notify = h.ctx.app.get(KoraNotifyService);

    await Promise.all([
      notify.sendAll(KoraNotice.Launch),
      notify.sendAll(KoraNotice.Launch),
    ]);

    expect(sent).toHaveLength(6);
    expect(new Set(sent.map((s) => s.to)).size).toBe(6);
  });

  async function seed(
    ...contacts: ({ email: string } | { phoneNumber: string })[]
  ) {
    await h.ctx.dataSource.getRepository(KoraParticipant).save(
      contacts.map((contact, i) => ({
        name: `Participant ${i}`,
        email: "email" in contact ? contact.email : null,
        phoneNumber: "phoneNumber" in contact ? contact.phoneNumber : null,
        timeZone: null,
        contactVerifiedAt: new Date(),
      })),
    );
  }
});
