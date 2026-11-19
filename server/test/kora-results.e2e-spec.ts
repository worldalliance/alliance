import { KoraProjectStatus } from "@alliance/common/kora";
import { R } from "@alliance/common/result";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import { KoraBatchService } from "src/kora/kora-batch.service";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { PushService } from "src/push/push.service";
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { closeTestApp } from "./e2e-test-utils";
import {
  koraConversation,
  koraJsonlFile,
  koraSessionExport,
} from "./kora-conversations";
import {
  koraAdminActor,
  koraClosesAt,
  koraHarness,
  ORIGIN,
  setKoraProjectStatus,
  type KoraHarness,
} from "./kora-fixtures";
import { forgetRateEvents, uniqueEmail } from "./otp-fixtures";

type State = {
  reviewerId: string;
  session: {
    id: string;
    items: {
      item: { conversationId: string; riskId: string; contentHash: string };
    }[];
  };
};

describe("Kora results and the more-reviews notice (e2e)", () => {
  let h: KoraHarness;
  let emailed: string[];
  let pushed: number[];
  let batchNumber = 0;

  const admin = (method: "get" | "post", path: string) =>
    request(h.ctx.app.getHttpServer())
      [method](path)
      .set("Authorization", `Bearer ${h.ctx.adminAccessToken}`);
  const moreToNotify = async () =>
    (await admin("get", "/kora/admin/project").expect(200)).body.moreToNotify;
  const upload = async () => {
    batchNumber++;
    const uploaded = await h.ctx.app.get(KoraBatchService).upload({
      conversationsText: koraJsonlFile(
        ...[1, 2, 3, 4].map((n) => koraConversation(`M${batchNumber}-${n}`)),
      ),
      reviewsPerConversation: 3,
      closesAt: koraClosesAt(),
      actor: koraAdminActor(h.ctx),
    });
    if (!uploaded.ok) throw new Error(JSON.stringify(uploaded.error));
  };
  const review = async (browser: TestAgent, options: { finish: boolean }) => {
    await browser
      .patch("/kora/review/onboarding")
      .set("Origin", ORIGIN)
      .send({ consented: true, onboarded: true })
      .expect(200);
    const s: State = (await browser.get("/kora/review").expect(200)).body;
    const given = s.session.items.map((i) => ({
      id: i.item.conversationId,
      riskId: i.item.riskId,
      contentHash: i.item.contentHash,
    }));
    const send = (end: boolean) =>
      browser
        .put(`/kora/review/sessions/${s.session.id}/export`)
        .set("Origin", ORIGIN)
        .send({
          export: koraSessionExport({
            reviewerId: s.reviewerId,
            sessionId: s.session.id,
            conversations: given,
            done: options.finish ? given.map((c) => c.id) : [],
            isDone: end,
            feedback: end,
          }),
        })
        .expect(200);
    await send(false);
    if (!options.finish) return;
    for (;;) {
      const { item } = (
        await browser
          .post(`/kora/review/sessions/${s.session.id}/next`)
          .set("Origin", ORIGIN)
          .expect(200)
      ).body;
      if (!item) break;
      given.push({
        id: item.conversationId,
        riskId: item.riskId,
        contentHash: item.contentHash,
      });
      await send(false);
    }
    await send(true);
  };
  const participant = async () => {
    const browser = h.browser();
    const email = uniqueEmail();
    await h.signedUp(browser, { email });
    return { browser, email };
  };
  const notifyMore = async () => {
    const res = await admin("post", "/kora/admin/notify-more").expect(200);
    for (let i = 0; i < 50 && (await moreToNotify()) > 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return res.body.queued;
  };

  beforeAll(async () => {
    h = await koraHarness();
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
    await h.ctx.dataSource.getRepository(KoraReviewer).deleteAll();
    await h.ctx.dataSource.getRepository(KoraBatch).deleteAll();
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Active);
    emailed = [];
    pushed = [];
    const mail = jest.spyOn(h.ctx.app.get(MailService), "sendUnrecordedMail");
    const signInCodes = mail.getMockImplementation();
    mail.mockImplementation(async (params) => {
      if (params.emailType !== EmailType.KoraMoreReviews) {
        if (!signInCodes) throw new Error("the harness captures sign-in codes");
        return signInCodes(params);
      }
      emailed.push(params.recipient);
      return R.success({ messageId: "m" });
    });
    jest
      .spyOn(h.ctx.app.get(PushService), "getPushForAllUserDevices")
      .mockImplementation(async (userId) => {
        pushed.push(userId);
        return [];
      });
  });

  afterAll(async () => {
    await closeTestApp(h.ctx.app);
  });

  it("tells reviewers who finished, once per new batch, and not those still reviewing", async () => {
    await upload();
    const done = await participant();
    await review(done.browser, { finish: true });
    const busy = await participant();
    await review(busy.browser, { finish: false });
    const member = request
      .agent(h.ctx.app.getHttpServer())
      .set("Authorization", `Bearer ${h.ctx.accessToken}`);
    await review(member, { finish: true });

    expect(await moreToNotify()).toBe(2);
    expect(await notifyMore()).toBe(2);
    expect(emailed).toEqual([done.email]);
    expect(pushed).toEqual([h.ctx.testUserId]);

    expect(await moreToNotify()).toBe(0);
    await upload();
    expect(await moreToNotify()).toBe(2);
  });

  it("refuses until the project is active", async () => {
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Pending);
    await admin("post", "/kora/admin/notify-more").expect(400);
  });

  it("downloads every export and counts the end-of-session feedback", async () => {
    await upload();
    const one = await participant();
    await review(one.browser, { finish: true });
    const two = await participant();
    await review(two.browser, { finish: false });

    const exports = (
      await admin("get", "/kora/admin/results/exports").expect(200)
    ).body.exports;
    expect(exports).toHaveLength(2);
    for (const e of exports) {
      expect(Object.keys(e.reviewer)).toEqual(["id"]);
    }

    const answers = (
      await admin("get", "/kora/admin/results/answers").expect(200)
    ).body;
    expect(answers).toMatchObject({ sessions: 1 });
    expect(answers.feedback).toContainEqual({
      question: "f1",
      answers: [{ value: "fully", count: 1 }],
    });
  });

  it("keeps results from non-admins", async () => {
    await request(h.ctx.app.getHttpServer())
      .get("/kora/admin/results/exports")
      .set("Authorization", `Bearer ${h.ctx.accessToken}`)
      .expect(401);
  });
});
