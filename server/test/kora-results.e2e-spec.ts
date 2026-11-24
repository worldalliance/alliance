import { KoraProjectStatus } from "@alliance/common/kora";
import { R } from "@alliance/common/result";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import { KoraBatchService } from "src/kora/kora-batch.service";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { PushService } from "src/push/push.service";
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { parse } from "yaml";
import { closeTestApp } from "./e2e-test-utils";
import {
  koraConversation,
  koraConversationsFile,
  koraExport,
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
  assignment: {
    id: string;
    transcripts: {
      transcript: { transcriptId: string; category: string };
      contentHash: string;
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
      transcriptsText: koraConversationsFile(
        ...[1, 2, 3, 4].map((n) => koraConversation(`M${batchNumber}-${n}`)),
      ),
      transcriptsPerAssignment: 2,
      reviewsPerTranscript: 3,
      closesAt: koraClosesAt(),
      actor: koraAdminActor(h.ctx),
    });
    if (!uploaded.ok) throw new Error(JSON.stringify(uploaded.error));
  };
  const timed = <E extends { results: object[] }>(e: E, timeMs?: number) =>
    timeMs === undefined
      ? e
      : { ...e, results: e.results.map((r) => ({ ...r, timeMs })) };
  const review = async (
    browser: TestAgent,
    options: { finish: boolean; profile?: boolean; timeMs?: number },
  ) => {
    const s: State = (await browser.get("/kora/review").expect(200)).body;
    const transcripts = [...s.assignment.transcripts];
    const send = (exitSurvey: boolean) =>
      browser
        .put(`/kora/review/assignments/${s.assignment.id}/export`)
        .set("Origin", ORIGIN)
        .send({
          export: {
            ...timed(
              koraExport({
                reviewerId: s.reviewerId,
                assignmentId: s.assignment.id,
                transcripts,
                done: options.finish
                  ? transcripts.map((t) => t.transcript.transcriptId)
                  : [],
                profile: options.profile,
              }),
              options.timeMs,
            ),
            ...(exitSurvey
              ? {
                  exitSurvey: {
                    exit_q1: "very",
                    exit_q2: null,
                    exit_q3: null,
                    exit_q4: null,
                    exit_q5: null,
                    exit_q6: null,
                  },
                }
              : {}),
          },
        })
        .expect(200);
    await send(false);
    if (!options.finish) return transcripts;
    for (;;) {
      const { next } = (
        await browser
          .post(`/kora/review/assignments/${s.assignment.id}/next`)
          .set("Origin", ORIGIN)
          .expect(200)
      ).body;
      if (!next) break;
      transcripts.push(next);
      await send(false);
    }
    await send(true);
    return transcripts;
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

  it("downloads every export and counts profile and exit-survey answers", async () => {
    await upload();
    const one = await participant();
    await review(one.browser, { finish: true, profile: true });
    const two = await participant();
    await review(two.browser, { finish: false });

    const exports = (
      await admin("get", "/kora/admin/results/exports").expect(200)
    ).body.exports;
    expect(exports).toHaveLength(2);
    for (const e of exports) {
      expect(Object.keys(e.reviewer)).toEqual(["id"]);
    }

    // KORA's own export of the same reviews matches its schema, which ajv's strict mode can't compile.
    const koraExport = (
      await admin("get", "/kora/admin/results/kora-export?kind=final").expect(
        200,
      )
    ).body;
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const valid = ajv.compile(
      parse(
        readFileSync(
          join(__dirname, "../../docs/kora/kora_export.schema.yaml"),
          "utf8",
        ),
      ),
    );
    expect(valid(koraExport) ? null : valid.errors).toBeNull();
    expect(koraExport.export.kind).toBe("final");
    expect(koraExport.ratings.length).toBeGreaterThan(0);

    const answers = (
      await admin("get", "/kora/admin/results/answers").expect(200)
    ).body;
    expect(answers).toMatchObject({ profiles: 1, exitSurveys: 1 });
    expect(answers.exitSurvey[0]).toEqual({
      question: "exit_q1",
      answers: [{ value: "very", count: 1 }],
    });
  });

  it("lists each conversation with its finished reviews and their times open", async () => {
    await upload();
    const timesById = new Map<string, number[]>();
    for (const timeMs of [270000, 90000, 30000]) {
      const { browser } = await participant();
      for (const { transcript } of await review(browser, {
        finish: true,
        timeMs,
      })) {
        const id = transcript.transcriptId;
        timesById.set(id, [...(timesById.get(id) ?? []), timeMs]);
      }
    }
    const median = (xs: number[]) => {
      const sorted = xs.toSorted((x, y) => x - y);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const rows = (await admin("get", "/kora/admin/conversations").expect(200))
      .body.conversations;
    expect(rows.map((r: { id: string }) => r.id)).toEqual(
      [1, 2, 3, 4].map((n) => `M${batchNumber}-${n}`),
    );
    expect([...timesById.values()].some((t) => t.length > 1)).toBe(true);
    for (const row of rows) {
      const times = timesById.get(row.id) ?? [];
      expect(row).toMatchObject({
        category: "academic_dishonesty_and_misuse",
        reviewsPerTranscript: 3,
        reviews: times.length,
        medianTimeMs: times.length ? median(times) : null,
        minTimeMs: times.length ? Math.min(...times) : null,
        maxTimeMs: times.length ? Math.max(...times) : null,
      });
    }
  });

  it("keeps results from non-admins", async () => {
    await request(h.ctx.app.getHttpServer())
      .get("/kora/admin/results/exports")
      .set("Authorization", `Bearer ${h.ctx.accessToken}`)
      .expect(401);
  });
});
