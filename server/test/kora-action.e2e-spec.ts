import { ActionActivityType } from "@alliance/common/actionActivity";
import { ActionTaskKind } from "@alliance/common/actionTask";
import { KoraProjectStatus, KoraReviewPhase } from "@alliance/common/kora";
import { milliseconds } from "date-fns";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { KoraAssignment } from "src/kora/entities/kora-assignment.entity";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import { KORA_ACTION_ACTIVE_SECONDS } from "src/kora/kora-active-time";
import { KoraBatchActionsService } from "src/kora/kora-batch-actions.service";
import { KoraBatchService } from "src/kora/kora-batch.service";
import { KoraModule } from "src/kora/kora.module";
import request from "supertest";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";
import {
  koraConversation,
  koraConversationsFile,
  koraExport,
} from "./kora-conversations";
import {
  koraAdminActor,
  koraClosesAt,
  ORIGIN,
  setKoraProjectStatus,
} from "./kora-fixtures";

describe("Kora review actions (e2e)", () => {
  let ctx: TestContext;

  const liveAction = async (name: string, taskKind: ActionTaskKind) => {
    const action = await ctx.dataSource.getRepository(Action).save({
      name,
      category: [],
      body: "Body",
      shortDescription: name,
      visibilityMode: VisibilityMode.Public,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      taskKind,
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: `${name} launch`,
      description: "Live",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - milliseconds({ seconds: 1 })),
      action,
    });
    return action;
  };
  const completed = (actionId: number) =>
    ctx.dataSource.getRepository(ActionActivity).existsBy({
      actionId,
      userId: ctx.testUserId,
      type: ActionActivityType.USER_COMPLETED,
    });

  beforeAll(async () => {
    ctx = await createTestApp([KoraModule]);
  }, 50000);

  beforeEach(async () => {
    await ctx.dataSource.getRepository(KoraReviewer).deleteAll();
    await ctx.dataSource.getRepository(KoraBatch).deleteAll();
    await setKoraProjectStatus(ctx, KoraProjectStatus.Active);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const uploadTwo = async () => {
    const uploaded = await ctx.app.get(KoraBatchService).upload({
      transcriptsText: koraConversationsFile(
        koraConversation("A1"),
        koraConversation("A2"),
      ),
      transcriptsPerAssignment: 2,
      reviewsPerTranscript: 1,
      closesAt: koraClosesAt(),
      actor: koraAdminActor(ctx),
    });
    if (!uploaded.ok) throw new Error(JSON.stringify(uploaded.error));
    return uploaded.value.batch;
  };
  const member = () =>
    request
      .agent(ctx.app.getHttpServer())
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .set("Origin", ORIGIN);
  /** Rates the first `count` conversations the assignment gives, asking for each next one as the tool does. */
  const rate = async (
    agent: ReturnType<typeof member>,
    count: number,
    statePath = "/kora/review",
  ) => {
    const state = (await agent.get(statePath).expect(200)).body;
    const id: string = state.assignment.id;
    const transcripts: {
      transcript: { transcriptId: string; category: string };
      contentHash: string;
    }[] = [...state.assignment.transcripts];
    const send = () =>
      agent
        .put(`/kora/review/assignments/${id}/export`)
        .send({
          export: koraExport({
            reviewerId: state.reviewerId,
            assignmentId: id,
            transcripts,
            done: transcripts.map((t) => t.transcript.transcriptId),
          }),
        })
        .expect(200);
    await send();
    while (transcripts.length < count) {
      const { next } = (
        await agent.post(`/kora/review/assignments/${id}/next`).expect(200)
      ).body;
      if (!next) return id;
      transcripts.push(next);
      await send();
    }
    return id;
  };
  const eventuallyCompleted = async (actionId: number) => {
    for (let i = 0; i < 50 && !(await completed(actionId)); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return completed(actionId);
  };

  const reviewPath = (actionId: number) => `/actions/${actionId}/kora-review`;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

  it("completes only the action whose assignment the member finished", async () => {
    await uploadTwo();
    const kora = await liveAction(
      "First Kora review",
      ActionTaskKind.KoraReview,
    );
    const later = await liveAction(
      "Second Kora review",
      ActionTaskKind.KoraReview,
    );
    await rate(member(), 2, reviewPath(kora.id));

    expect(await eventuallyCompleted(kora.id)).toBe(true);
    await settle();
    expect(await completed(later.id)).toBe(false);
  });

  it("completes no action for an assignment started outside one", async () => {
    await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    await rate(member(), 2);

    await settle();
    expect(await completed(kora.id)).toBe(false);
  });

  it("resumes the action's own assignment on a later visit", async () => {
    await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    const first = (await member().get(reviewPath(kora.id)).expect(200)).body;
    const again = (await member().get(reviewPath(kora.id)).expect(200)).body;

    expect(first.assignment.extra).toBe(false);
    expect(again.assignment.id).toBe(first.assignment.id);
  });

  it("completes the action once 15 active minutes have passed and the current conversation is finished", async () => {
    await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    const agent = member();
    const state = (await agent.get(reviewPath(kora.id)).expect(200)).body;
    const id: string = state.assignment.id;
    await ctx.dataSource
      .getRepository(KoraAssignment)
      .update({ id }, { activeSeconds: KORA_ACTION_ACTIVE_SECONDS });

    const saved = await agent
      .put(`/kora/review/assignments/${id}/export`)
      .send({
        export: koraExport({
          reviewerId: state.reviewerId,
          assignmentId: id,
          transcripts: state.assignment.transcripts,
          done: [state.assignment.transcripts[0].transcript.transcriptId],
        }),
      })
      .expect(200);
    expect(saved.body.completed).toBe(true);
    const { next } = (
      await agent.post(`/kora/review/assignments/${id}/next`).expect(200)
    ).body;
    expect(next).toBeNull();
    expect(await eventuallyCompleted(kora.id)).toBe(true);
  });

  it("caps reported active time by the time since the last report", async () => {
    await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    const agent = member();
    const id: string = (await agent.get(reviewPath(kora.id)).expect(200)).body
      .assignment.id;
    const report = (seconds: number) =>
      agent
        .post(`/kora/review/assignments/${id}/active-time`)
        .send({ seconds });

    await report(30).expect(204);
    await report(30).expect(204);
    await report(61).expect(400);

    const stored = await ctx.dataSource
      .getRepository(KoraAssignment)
      .findOneByOrFail({ id });
    expect(stored.activeSeconds).toBeGreaterThanOrEqual(30);
    expect(stored.activeSeconds).toBeLessThan(40);
  });

  it("completes the action when there is nothing to review", async () => {
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    const state = (await member().get(reviewPath(kora.id)).expect(200)).body;

    expect(state.phase).toBe(KoraReviewPhase.NoneLeft);
    expect(await completed(kora.id)).toBe(true);
    await member().get(reviewPath(kora.id)).expect(200);
  });

  it("tells the member's client the action is a Kora review", async () => {
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    const { body } = await member().get(`/actions/slug/${kora.id}`).expect(200);
    expect(body.taskKind).toBe(ActionTaskKind.KoraReview);
  });

  it("refuses a form action", async () => {
    const form = await liveAction("Some form action", ActionTaskKind.Form);
    await member().get(reviewPath(form.id)).expect(404);
  });

  it("completes the action when, after a retire, nothing is left to give", async () => {
    const batch = await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    const id = await rate(member(), 1, reviewPath(kora.id));
    expect(await completed(kora.id)).toBe(false);

    const retired = await ctx.app
      .get(KoraBatchActionsService)
      .retire({ batchId: batch.id, actor: koraAdminActor(ctx) });
    expect(retired.ok).toBe(true);
    await member().post(`/kora/review/assignments/${id}/next`).expect(200);

    expect(await eventuallyCompleted(kora.id)).toBe(true);
  });

  it("completes the action on the next visit when a retire empties an assignment never rated", async () => {
    const batch = await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    const id: string = (await member().get(reviewPath(kora.id)).expect(200))
      .body.assignment.id;

    await ctx.app
      .get(KoraBatchActionsService)
      .retire({ batchId: batch.id, actor: koraAdminActor(ctx) });
    await member().post(`/kora/review/assignments/${id}/next`).expect(200);
    await settle();
    expect(await completed(kora.id)).toBe(false);

    const state = (await member().get(reviewPath(kora.id)).expect(200)).body;
    expect(state.phase).toBe(KoraReviewPhase.NoneLeft);
    expect(await completed(kora.id)).toBe(true);
  });
});
