import type { CohortExpression } from "@alliance/common/cohort-expression";
import { randomUUID } from "crypto";
import request from "supertest";
import type { Repository } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import { FollowUpForm } from "../src/actions/entities/follow-up-form.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
} from "./e2e-test-utils";

describe("Saving a cohort that names a tag (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let followUpFormRepo: Repository<FollowUpForm>;
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const refusal = (tagId: string) =>
    `No tag has id "${tagId}". Every Tag condition in the cohort must name an existing tag.`;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    followUpFormRepo = ctx.dataSource.getRepository(FollowUpForm);
    ({ createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    await followUpFormRepo.query("DELETE FROM follow_up_form");
    await cleanUp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const admin = () => request(ctx.app.getHttpServer());
  const missingTagId = randomUUID();
  const missingTag: CohortExpression = { type: "Tag", tagId: missingTagId };

  const updateCohort = async (
    cohortExpression: CohortExpression,
    stored: CohortExpression = { type: "AllMembers" },
  ) => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: stored,
    });
    const response = await admin()
      .patch(`/actions/${action.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ cohortExpression });
    const saved = await actionRepo.findOneByOrFail({ id: action.id });
    return { response, saved: saved.cohortExpression };
  };

  it.each([
    ["a deleted tag", randomUUID()],
    ["no tag", ""],
  ])("rejects an action cohort naming %s", async (_, tagId) => {
    const { response, saved } = await updateCohort({
      type: "OR",
      children: [
        { type: "Tag", tagId: ctx.defaultTag.id },
        { type: "NOT", child: { type: "Tag", tagId } },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(refusal(tagId));
    expect(saved).toEqual({ type: "AllMembers" });
  });

  it("keeps saving an action cohort that already named a deleted tag", async () => {
    const cohortExpression: CohortExpression = {
      type: "OR",
      children: [{ type: "Tag", tagId: ctx.defaultTag.id }, missingTag],
    };

    const { response, saved } = await updateCohort(
      cohortExpression,
      missingTag,
    );

    expect(response.status).toBe(200);
    expect(saved).toEqual(cohortExpression);
  });

  it("names only the deleted tags an action cohort newly names", async () => {
    const added = randomUUID();

    const { response } = await updateCohort(
      { type: "AND", children: [missingTag, { type: "Tag", tagId: added }] },
      missingTag,
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(refusal(added));
  });

  it("saves an action cohort naming existing tags", async () => {
    const cohortExpression: CohortExpression = {
      type: "AND",
      children: [
        { type: "Tag", tagId: ctx.defaultTag.id },
        { type: "NOT", child: { type: "Tag", tagId: ctx.defaultTag.id } },
      ],
    };

    const { response, saved } = await updateCohort(cohortExpression);

    expect(response.status).toBe(200);
    expect(saved).toEqual(cohortExpression);
  });

  it("rejects creating an action whose cohort names a deleted tag", async () => {
    const before = await actionRepo.count();

    const response = await admin()
      .post("/actions/create")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        name: "Tagged",
        body: "Body",
        category: [],
        image: "",
        timeEstimate: 5,
        shortDescription: "Body",
        visibilityMode: VisibilityMode.Public,
        isContractSigningAction: false,
        shouldCompleteAfterDeadline: false,
        isForumParticipationAction: false,
        optional: false,
        preventCompletion: false,
        publicOnly: false,
        onboarding: false,
        cohortExpression: missingTag,
      } satisfies CreateActionDto);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(refusal(missingTagId));
    expect(await actionRepo.count()).toBe(before);
  });

  it("rejects pasting an action whose cohort names a deleted tag", async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    const exported = await admin()
      .get(`/actions/export/${action.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    const before = await actionRepo.count();

    const response = await admin()
      .post("/actions/pasteJson")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        body: JSON.stringify({
          ...exported.body,
          cohortExpression: missingTag,
        }),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(refusal(missingTagId));
    expect(await actionRepo.count()).toBe(before);
  });

  describe("on a follow-up form", () => {
    const createForm = async () => {
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      const { form } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Debrief",
        schema: { title: "Debrief", pages: [], outputViews: [] },
      });
      return { action, form };
    };

    it("rejects creating one whose cohort names a deleted tag", async () => {
      const { action, form } = await createForm();

      const response = await admin()
        .post(`/actions/${action.id}/follow-up-forms`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ formId: form.id, cohortExpression: missingTag });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(refusal(missingTagId));
      expect(await followUpFormRepo.count()).toBe(0);
    });

    it("rejects updating one's cohort to name a deleted tag", async () => {
      const { action, form } = await createForm();
      const followUpForm = await followUpFormRepo.save({
        actionId: action.id,
        formId: form.id,
        cohortExpression: { type: "AllMembers" },
      });

      const response = await admin()
        .patch(`/actions/follow-up-forms/${followUpForm.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ cohortExpression: missingTag });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(refusal(missingTagId));
      expect(
        (await followUpFormRepo.findOneByOrFail({ id: followUpForm.id }))
          .cohortExpression,
      ).toEqual({ type: "AllMembers" });
    });

    it("keeps saving one whose cohort already named a deleted tag", async () => {
      const { action, form } = await createForm();
      const followUpForm = await followUpFormRepo.save({
        actionId: action.id,
        formId: form.id,
        cohortExpression: missingTag,
      });

      await admin()
        .patch(`/actions/follow-up-forms/${followUpForm.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Renamed", cohortExpression: missingTag })
        .expect(200);

      expect(
        (await followUpFormRepo.findOneByOrFail({ id: followUpForm.id })).name,
      ).toBe("Renamed");
    });
  });
});
