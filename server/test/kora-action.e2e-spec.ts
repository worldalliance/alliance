import { ActionActivityType } from "@alliance/common/actionActivity";
import { ActionTaskKind } from "@alliance/common/actionTask";
import { KoraProjectStatus } from "@alliance/common/kora";
import { milliseconds } from "date-fns";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
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
  koraJsonlFile,
  koraSessionExport,
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
      conversationsText: koraJsonlFile(
        koraConversation("A1"),
        koraConversation("A2"),
      ),
      reviewsPerConversation: 1,
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
  type Served = { id: string; riskId: string; contentHash: string };

  /** Judges the first `count` conversations a session gives, asking for each next one as the tool does. */
  const rate = async (
    agent: ReturnType<typeof member>,
    count: number,
    options: { end?: boolean } = {},
  ) => {
    await agent
      .patch("/kora/review/onboarding")
      .send({ consented: true, onboarded: true })
      .expect(200);
    const state = (await agent.get("/kora/review").expect(200)).body;
    const id: string = state.session.id;
    const given: Served[] = state.session.items.map(
      (i: { item: Served & { conversationId: string } }) => ({
        id: i.item.conversationId,
        riskId: i.item.riskId,
        contentHash: i.item.contentHash,
      }),
    );
    const send = (end = false) =>
      agent
        .put(`/kora/review/sessions/${id}/export`)
        .send({
          export: koraSessionExport({
            reviewerId: state.reviewerId,
            sessionId: id,
            conversations: given,
            done: given.map((c) => c.id),
            isDone: end,
            feedback: end,
          }),
        })
        .expect(200);
    await send();
    while (given.length < count) {
      const { item } = (
        await agent.post(`/kora/review/sessions/${id}/next`).expect(200)
      ).body;
      if (!item) break;
      given.push({
        id: item.conversationId,
        riskId: item.riskId,
        contentHash: item.contentHash,
      });
      await send();
    }
    if (options.end) await send(true);
    return id;
  };

  /** The tool's last save of a session, once its feedback screen is done. */
  const endSession = async (
    agent: ReturnType<typeof member>,
    sessionId: string,
  ) => {
    const state = (await agent.get("/kora/review").expect(200)).body;
    await agent
      .put(`/kora/review/sessions/${sessionId}/export`)
      .send({
        export: koraSessionExport({
          reviewerId: state.reviewerId,
          sessionId,
          conversations: (state.session?.items ?? []).map(
            (i: { item: Served & { conversationId: string } }) => ({
              id: i.item.conversationId,
              riskId: i.item.riskId,
              contentHash: i.item.contentHash,
            }),
          ),
          done: (state.session?.items ?? []).map(
            (i: { item: { conversationId: string } }) => i.item.conversationId,
          ),
          isDone: true,
          feedback: true,
        }),
      })
      .expect(200);
  };
  const eventuallyCompleted = async (actionId: number) => {
    for (let i = 0; i < 50 && !(await completed(actionId)); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return completed(actionId);
  };

  it("completes a member's Kora actions when they finish their first session", async () => {
    await uploadTwo();
    const kora = await liveAction(
      "Review chatbot conversations",
      ActionTaskKind.KoraReview,
    );
    const other = await liveAction("Some form action", ActionTaskKind.Form);
    await rate(member(), 2, { end: true });

    expect(await eventuallyCompleted(kora.id)).toBe(true);
    expect(await completed(other.id)).toBe(false);
  });

  it("completes a member's Kora actions when a retire leaves their session nothing more to give", async () => {
    const batch = await uploadTwo();
    const kora = await liveAction(
      "Review chatbot conversations",
      ActionTaskKind.KoraReview,
    );
    const agent = member();
    const id = await rate(agent, 1);
    expect(await completed(kora.id)).toBe(false);

    const retired = await ctx.app
      .get(KoraBatchActionsService)
      .retire({ batchId: batch.id, actor: koraAdminActor(ctx) });
    expect(retired.ok).toBe(true);
    expect(
      (await agent.post(`/kora/review/sessions/${id}/next`).expect(200)).body
        .done,
    ).toBeTruthy();
    await endSession(agent, id);

    expect(await eventuallyCompleted(kora.id)).toBe(true);
  });

  it("leaves a member's Kora actions open when a retire empties a session they never judged", async () => {
    const batch = await uploadTwo();
    const kora = await liveAction(
      "Review chatbot conversations",
      ActionTaskKind.KoraReview,
    );
    await member().get("/kora/review").expect(200);

    await ctx.app
      .get(KoraBatchActionsService)
      .retire({ batchId: batch.id, actor: koraAdminActor(ctx) });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await completed(kora.id)).toBe(false);
  });
});
