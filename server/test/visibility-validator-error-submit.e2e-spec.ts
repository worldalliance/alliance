import type { FormSchema } from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import type { CreateActionDto } from "src/actions/dto/action.dto";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import {
  CustomValidator,
  CustomValidatorType,
} from "src/tasks/entities/customvalidator.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import { createActionDefaults } from "./action-requests";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

describe("Submitting a form whose visibility validator throws (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it.each([
    ["the field it gates is shown", undefined],
    [
      "another condition already hides the page",
      {
        formula: "condition1",
        conditions: {
          condition1: { kind: "deviceType", deviceType: ["mobile"] },
        },
      },
    ],
  ] satisfies [string, FormSchema["pages"][number]["visibleIfFormula"]][])(
    "refuses the submission when %s",
    async (_, pageVisibleIfFormula) => {
      const { id: validatorId } = await ctx.dataSource
        .getRepository(CustomValidator)
        .save({
          type: CustomValidatorType.MemberCommunity,
          idArgument: null,
          expression: null,
        });
      const schema: FormSchema = {
        pages: [
          {
            id: "p1",
            visibleIfFormula: pageVisibleIfFormula,
            fields: [
              {
                id: "gated",
                type: "input",
                kind: "text",
                label: "Gated",
                visibleIfFormula: {
                  formula: "condition1",
                  conditions: {
                    condition1: { kind: "validator", validatorId },
                  },
                },
              },
            ],
          },
        ],
        outputViews: [],
        aggregateViews: [],
      };
      const form = await request(ctx.app.getHttpServer())
        .post("/tasks/createForm")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ title: "Gated by a broken validator", schema })
        .expect(201);
      const actions = ctx.dataSource.getRepository(Action);
      const action = await actions.save(
        actions.create({
          ...createActionDefaults,
          name: "Gated by a broken validator",
          cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
          taskFormId: form.body.id,
        } satisfies CreateActionDto),
      );
      await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Member phase",
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ hours: 1 })),
        action,
      });

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${form.body.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          answers: { gated: "An answer" },
          formSnapshotId: form.body.formSnapshotId,
          actionId: action.id,
          deviceType: "desktop",
        })
        .expect(500);

      expect(
        await ctx.dataSource
          .getRepository(FormResponse)
          .countBy({ formId: form.body.id }),
      ).toBe(0);
    },
  );
});
