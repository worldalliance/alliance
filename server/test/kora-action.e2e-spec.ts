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
  koraAdminActor,
  koraClosesAt,
  ORIGIN,
  setKoraProjectStatus,
} from "./kora-fixtures";
import { koraExport, koraPair, koraPairsFile } from "./kora-pairs";

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
      transcriptsText: koraPairsFile(koraPair("A1"), koraPair("A2")),
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
  const rate = async (
    agent: ReturnType<typeof member>,
    pick: (ids: string[]) => string[],
  ) => {
    const state = (await agent.get("/kora/review").expect(200)).body;
    const transcripts = state.assignment.transcripts;
    await agent
      .put(`/kora/review/assignments/${state.assignment.id}/export`)
      .send({
        export: koraExport({
          reviewerId: state.reviewerId,
          assignmentId: state.assignment.id,
          transcripts,
          done: pick(
            transcripts.map(
              (t: { transcript: { transcriptId: string } }) =>
                t.transcript.transcriptId,
            ),
          ),
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

  it("completes a member's Kora actions when they finish their first assignment", async () => {
    await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    const other = await liveAction("Some form action", ActionTaskKind.Form);
    await rate(member(), (ids) => ids);

    expect(await eventuallyCompleted(kora.id)).toBe(true);
    expect(await completed(other.id)).toBe(false);
  });

  it("completes a member's Kora actions when a retire finishes their first assignment", async () => {
    const batch = await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
      ActionTaskKind.KoraReview,
    );
    await rate(member(), (ids) => ids.slice(0, 1));
    expect(await completed(kora.id)).toBe(false);

    const retired = await ctx.app
      .get(KoraBatchActionsService)
      .retire({ batchId: batch.id, actor: koraAdminActor(ctx) });
    expect(retired.ok).toBe(true);

    expect(await eventuallyCompleted(kora.id)).toBe(true);
  });

  it("leaves a member's Kora actions open when a retire empties an assignment they never rated", async () => {
    const batch = await uploadTwo();
    const kora = await liveAction(
      "Review chatbot transcripts",
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
