import { ActionActivityType } from "@alliance/common/actionActivity";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import { milliseconds } from "date-fns";
import { CreateActionDto } from "src/actions/dto/action.dto";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { FollowUpForm } from "src/actions/entities/follow-up-form.entity";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { TasksService } from "src/tasks/tasks.service";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  createFormWithSnapshot,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

const sourceSchema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "colors",
          type: "input",
          kind: "multiselect",
          label: "Colors",
          options: [
            { label: "Red", value: "red" },
            { label: "Blue", value: "blue" },
            { label: "Green", value: "green" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

const latestColors = (sourceFormId: number) => ({
  inputs: {
    input1: { kind: "sourceField" as const, sourceFormId, fieldId: "colors" },
  },
  formula: "input1.at(-1) ?? []",
});

describe("Options formulas (e2e)", () => {
  let ctx: TestContext;
  let formRepo: Repository<Form>;
  let responseRepo: Repository<FormResponse>;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let activityRepo: Repository<ActionActivity>;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    formRepo = ctx.dataSource.getRepository(Form);
    responseRepo = ctx.dataSource.getRepository(FormResponse);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
  }, 50000);

  afterEach(async () => {
    await activityRepo.query("DELETE FROM action_activity");
    await responseRepo.query("DELETE FROM form_response");
    await formRepo.query("DELETE FROM form");
    await eventRepo.query("DELETE FROM action_event");
    await actionRepo.query("DELETE FROM action");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createSource = async () => {
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Source",
      schema: sourceSchema,
    });
    return { formId: form.id, snapshotId: snapshot.id };
  };

  const respondToSource = async (
    source: { formId: number; snapshotId: number },
    colors: string[],
  ): Promise<number> => {
    const saved = await responseRepo.save(
      responseRepo.create({
        formId: source.formId,
        formSnapshotId: source.snapshotId,
        user: { id: ctx.testUserId },
        answers: { colors },
        publicAnswers: {},
      }),
    );
    return saved.id;
  };

  const createForm = async (schema: FormSchema) => {
    const created = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Destination", schema })
      .expect(201);
    return {
      formId: created.body.id as number,
      formSnapshotId: created.body.formSnapshotId as number,
    };
  };

  const createAction = async (taskFormId: number): Promise<Action> => {
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Pick a color",
        category: [],
        body: "Body copy",
        shortDescription: "Short copy",
        taskFormId,
        isForumParticipationAction: false,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: false,
        publicOnly: false,
        isContractSigningAction: false,
        onboarding: false,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      } satisfies CreateActionDto),
    );
    await eventRepo.save(
      eventRepo.create({
        title: "Live",
        description: "Live",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ seconds: 1 })),
        action,
      }),
    );
    return action;
  };

  const pickSchema = (sourceFormId: number, required = false): FormSchema => ({
    pages: [
      {
        id: "p1",
        fields: [
          {
            id: "pick",
            type: "input",
            kind: "select",
            label: "Pick",
            options: [],
            required,
            optionsFormula: latestColors(sourceFormId),
          },
        ],
      },
    ],
    outputViews: [],
  });

  const setUp = async (schema: (sourceFormId: number) => FormSchema) => {
    const source = await createSource();
    const destination = await createForm(schema(source.formId));
    const action = await createAction(destination.formId);
    const submit = (body: {
      answers: Record<string, unknown>;
      formulaSources?: { formId: number; responseIds: number[] }[];
    }) =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${destination.formId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          ...body,
          formSnapshotId: destination.formSnapshotId,
          actionId: action.id,
          deviceType: "desktop",
        });
    const withdraw = (body: {
      answers: Record<string, unknown>;
      formulaSources?: { formId: number; responseIds: number[] }[];
    }) =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/optout/${destination.formId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          actionId: action.id,
          reason: "",
          outOfTime: true,
          isMoral: false,
          partialFormData: {
            ...body,
            formSnapshotId: destination.formSnapshotId,
            actionId: action.id,
            deviceType: "desktop",
          },
        });
    const submitAsGuest = (answers: Record<string, unknown>) =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/submitPublicForm/${destination.formId}`)
        .send({
          answers,
          formSnapshotId: destination.formSnapshotId,
          actionId: action.id,
          deviceType: "desktop",
        });
    return { source, destination, action, submit, withdraw, submitAsGuest };
  };

  const savedChoices = async (formId: number) =>
    (await responseRepo.findOneOrFail({ where: { formId } })).formulaChoices;

  it("saves the label of the choice picked from the latest submission", async () => {
    const { source, submit } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red", "blue"]);

    const response = await submit({
      answers: { pick: "blue" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(201);

    expect(response.body.formulaChoices).toEqual({
      pick: [{ label: "Blue", value: "blue" }],
    });
  });

  it("reads a source formula field's answers with the labels its response saved", async () => {
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Source",
      schema: {
        pages: [
          {
            id: "p1",
            fields: [
              {
                id: "colors",
                type: "input",
                kind: "multiselect",
                label: "Colors",
                options: [],
                optionsFormula: {
                  inputs: {},
                  formula: "[{ label: 'Crimson', value: 'red' }]",
                },
              },
            ],
          },
        ],
        outputViews: [],
      },
    });
    const destination = await createForm(pickSchema(form.id));
    const action = await createAction(destination.formId);
    const first = await responseRepo.save(
      responseRepo.create({
        formId: form.id,
        formSnapshotId: snapshot.id,
        user: { id: ctx.testUserId },
        answers: { colors: ["red"] },
        formulaChoices: { colors: [{ label: "Crimson", value: "red" }] },
        publicAnswers: {},
      }),
    );

    const response = await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${destination.formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers: { pick: "red" },
        formulaSources: [{ formId: form.id, responseIds: [first.id] }],
        formSnapshotId: destination.formSnapshotId,
        actionId: action.id,
        deviceType: "desktop",
      })
      .expect(201);

    expect(response.body.formulaChoices).toEqual({
      pick: [{ label: "Crimson", value: "red" }],
    });
  });

  it("accepts a cleared optional select", async () => {
    const { source, submit } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);

    const response = await submit({
      answers: { pick: "" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(201);
    expect(response.body.formulaChoices).toEqual({});
  });

  it("rejects a choice the formula doesn't offer", async () => {
    const { source, submit } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);

    const response = await submit({
      answers: { pick: "green" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(400);

    expect(response.body.message).toBe(
      "Field Pick has a choice its options don't offer",
    );
  });

  it("checks against the history the form loaded, not a submission made since", async () => {
    const { source, submit } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);
    await respondToSource(source, ["green"]);
    const formulaSources = [{ formId: source.formId, responseIds: [first] }];

    await submit({ answers: { pick: "green" }, formulaSources }).expect(400);
    await submit({ answers: { pick: "red" }, formulaSources }).expect(201);
  });

  it("asks for a reload when the loaded history can't be matched", async () => {
    const { source, submit } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);

    const response = await submit({
      answers: { pick: "red" },
      formulaSources: [{ formId: source.formId, responseIds: [first + 1000] }],
    }).expect(409);

    expect(response.body.message).toBe(FORMULA_SOURCES_CHANGED);
  });

  it("asks for a reload when a source form the options read was deleted", async () => {
    const { source, submit } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);
    await responseRepo.delete(first);
    await formRepo.delete(source.formId);

    const response = await submit({
      answers: { pick: "red" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(409);

    expect(response.body.message).toBe(FORMULA_SOURCES_CHANGED);
  });

  it("fails rather than check choices against a source response it can't read", async () => {
    const { source, submit } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);
    await responseRepo.query(
      `UPDATE form_response SET answers = '"red"'::jsonb WHERE id = $1`,
      [first],
    );

    await submit({
      answers: { pick: "red" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(500);
  });

  it("rejects a choice submitted without the history it was picked from", async () => {
    const { source, submit } = await setUp(pickSchema);
    await respondToSource(source, ["red"]);
    await submit({ answers: { pick: "red" } }).expect(400);
  });

  it("accepts an unanswered formula field without the history it read", async () => {
    const { submit } = await setUp(pickSchema);
    const response = await submit({ answers: { pick: "" } }).expect(201);
    expect(response.body.formulaChoices).toEqual({});
  });

  it("requires a required field whose formula offers nothing", async () => {
    const { source, submit } = await setUp((formId) =>
      pickSchema(formId, true),
    );
    await submit({
      answers: {},
      formulaSources: [{ formId: source.formId, responseIds: [] }],
    }).expect(400);
  });

  it("enforces a formula multiselect's selection limit", async () => {
    const { source, submit } = await setUp((formId) => ({
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "picks",
              type: "input",
              kind: "multiselect",
              label: "Picks",
              options: [],
              maxSelections: 1,
              optionsFormula: latestColors(formId),
            },
          ],
        },
      ],
      outputViews: [],
    }));
    const first = await respondToSource(source, ["red", "blue"]);

    const response = await submit({
      answers: { picks: ["red", "blue"] },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(400);

    expect(response.body.message).toBe(
      "Field Picks allows selecting up to 1 options.",
    );
  });

  it("checks a follow-up form's choices and saves their labels", async () => {
    const source = await createSource();
    const destination = await createForm(pickSchema(source.formId));
    const action = await createAction(source.formId);
    await activityRepo.save(
      activityRepo.create({
        actionId: action.id,
        userId: ctx.testUserId,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );
    const followUp = await ctx.dataSource.getRepository(FollowUpForm).save({
      actionId: action.id,
      formId: destination.formId,
      startDate: new Date(Date.now() - milliseconds({ seconds: 1 })),
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    const first = await respondToSource(source, ["red", "blue"]);
    const submitFollowUp = (body: {
      answers: Record<string, unknown>;
      formulaSources?: { formId: number; responseIds: number[] }[];
    }) =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/submitFollowUpForm/${followUp.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          ...body,
          formSnapshotId: destination.formSnapshotId,
          deviceType: "desktop",
        });

    await submitFollowUp({ answers: { pick: "blue" } }).expect(400);
    await submitFollowUp({
      answers: { pick: "blue" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(201);
    expect(await savedChoices(destination.formId)).toEqual({
      pick: [{ label: "Blue", value: "blue" }],
    });
  });

  it("saves the labels of a withdrawal's choices", async () => {
    const { source, destination, withdraw } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red", "blue"]);

    await withdraw({
      answers: { pick: "blue" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(201);

    expect(await savedChoices(destination.formId)).toEqual({
      pick: [{ label: "Blue", value: "blue" }],
    });
  });

  it("saves a withdrawal whose history can't be matched, without labels", async () => {
    const { source, destination, withdraw } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);

    await withdraw({
      answers: { pick: "red" },
      formulaSources: [{ formId: source.formId, responseIds: [first + 1000] }],
    }).expect(201);
    expect(await savedChoices(destination.formId)).toEqual({});
  });

  it("doesn't load the history for a withdrawal selecting no formula choice", async () => {
    const { source, destination, withdraw } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);
    const loadHistory = jest.spyOn(
      ctx.app.get(TasksService),
      "getFormResponseHistory",
    );

    await withdraw({
      answers: { pick: "" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(201);

    expect(loadHistory).not.toHaveBeenCalled();
    expect(await savedChoices(destination.formId)).toEqual({});
    loadHistory.mockRestore();
  });

  it("saves a withdrawal whose history can't be read, without labels", async () => {
    const { source, destination, submit, withdraw } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);
    await responseRepo.update(first, { formulaChoices: { colors: "red" } });
    const body = {
      answers: { pick: "red" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    };

    const refused = await submit(body).expect(500);
    expect(refused.body.message).toContain(`Can't read response ${first}`);
    await withdraw(body).expect(201);
    expect(await savedChoices(destination.formId)).toEqual({});
  });

  it("saves the labels of a withdrawal that reads no other form and names no sources", async () => {
    const { destination, withdraw } = await setUp(() => ({
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "local",
              type: "input",
              kind: "multiselect",
              label: "Local",
              options: [{ label: "Here", value: "here" }],
            },
            {
              id: "fromLocal",
              type: "input",
              kind: "select",
              label: "From local",
              options: [],
              optionsFormula: {
                inputs: {
                  input1: { kind: "field" as const, fieldId: "local" },
                },
                formula: "input1 ?? []",
              },
            },
          ],
        },
      ],
      outputViews: [],
    }));

    await withdraw({
      answers: { local: ["here"], fromLocal: "here" },
    }).expect(201);
    expect(await savedChoices(destination.formId)).toEqual({
      fromLocal: [{ label: "Here", value: "here" }],
    });
  });

  it("saves a withdrawal with malformed formula sources, without labels", async () => {
    const { destination, action } = await setUp(pickSchema);

    await request(ctx.app.getHttpServer())
      .post(`/tasks/optout/${destination.formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        actionId: action.id,
        reason: "",
        outOfTime: true,
        isMoral: false,
        partialFormData: {
          answers: { pick: "red" },
          formulaSources: { formId: 1 },
          formSnapshotId: destination.formSnapshotId,
          actionId: action.id,
          deviceType: "desktop",
        },
      })
      .expect(201);
    expect(await savedChoices(destination.formId)).toEqual({});
  });

  const hiddenUnlessYes = {
    visibleIfFormula: {
      conditions: {
        condition1: {
          kind: "equals" as const,
          when: "toggle",
          equals: "yes",
        },
      },
      formula: "condition1",
    },
  };
  const hiddenInputSchema = (): FormSchema => ({
    pages: [
      {
        id: "p1",
        fields: [
          {
            id: "toggle",
            type: "input",
            kind: "select",
            label: "Toggle",
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
          {
            id: "local",
            type: "input",
            kind: "multiselect",
            label: "Local",
            options: [{ label: "Here", value: "here" }],
            ...hiddenUnlessYes,
          },
          {
            id: "fromLocal",
            type: "input",
            kind: "select",
            label: "From local",
            options: [],
            optionsFormula: {
              inputs: { input1: { kind: "field" as const, fieldId: "local" } },
              formula: "input1 ?? []",
            },
          },
          {
            id: "hiddenPick",
            type: "input",
            kind: "select",
            label: "Hidden pick",
            options: [],
            optionsFormula: {
              inputs: {},
              formula: "[{ label: 'A', value: 'a' }]",
            },
            ...hiddenUnlessYes,
          },
        ],
      },
    ],
    outputViews: [],
  });

  const submitters = {
    member:
      ({ submit }: Awaited<ReturnType<typeof setUp>>) =>
      (answers: Record<string, unknown>) =>
        submit({ answers, formulaSources: [] }),
    guest: ({ submitAsGuest }: Awaited<ReturnType<typeof setUp>>) =>
      submitAsGuest,
  };

  describe.each(Object.entries(submitters))("for a %s", (_, submitter) => {
    it("accepts a hidden formula field's choice without checking or labelling it", async () => {
      const submit = submitter(await setUp(hiddenInputSchema));

      const response = await submit({
        toggle: "no",
        hiddenPick: "gone",
      }).expect(201);

      expect(response.body.formulaChoices).toEqual({});
      expect(response.body.answers).toEqual({ toggle: "no" });
    });

    it("refuses a choice only a hidden answer would offer", async () => {
      const submit = submitter(await setUp(hiddenInputSchema));

      await submit({ toggle: "no", local: ["here"], fromLocal: "here" }).expect(
        400,
      );
    });
  });

  it("checks every row of a list sub-field", async () => {
    const { source, submit } = await setUp((formId) => ({
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "rows",
              type: "input",
              kind: "list",
              label: "Rows",
              fields: [
                {
                  id: "cell",
                  type: "input",
                  kind: "multiselect",
                  label: "Cell",
                  options: [],
                  optionsFormula: latestColors(formId),
                },
              ],
            },
          ],
        },
      ],
      outputViews: [],
    }));
    const first = await respondToSource(source, ["red", "blue"]);
    const formulaSources = [{ formId: source.formId, responseIds: [first] }];

    await submit({
      answers: { rows: [{ cell: ["red"] }, { cell: ["green"] }] },
      formulaSources,
    }).expect(400);
    const response = await submit({
      answers: { rows: [{ cell: ["red"] }, { cell: ["blue", "red"] }] },
      formulaSources,
    }).expect(201);

    expect(response.body.formulaChoices).toEqual({
      cell: [
        { label: "Red", value: "red" },
        { label: "Blue", value: "blue" },
      ],
    });
  });

  it("checks a guest's choices against no submissions", async () => {
    const { submitAsGuest } = await setUp((formId) => ({
      pages: [
        {
          id: "p1",
          fields: [
            ...pickSchema(formId).pages[0].fields,
            {
              id: "local",
              type: "input",
              kind: "multiselect",
              label: "Local",
              options: [{ label: "Here", value: "here" }],
            },
            {
              id: "fromLocal",
              type: "input",
              kind: "select",
              label: "From local",
              options: [],
              optionsFormula: {
                inputs: {
                  input1: { kind: "field" as const, fieldId: "local" },
                },
                formula: "input1 ?? []",
              },
            },
          ],
        },
      ],
      outputViews: [],
    }));

    await submitAsGuest({ pick: "red" }).expect(400);
    const response = await submitAsGuest({
      local: ["here"],
      fromLocal: "here",
    }).expect(201);

    expect(response.body.formulaChoices).toEqual({
      fromLocal: [{ label: "Here", value: "here" }],
    });
  });

  it("accepts a guest's unanswered formula field whose formula fails on their answers", async () => {
    const { submitAsGuest } = await setUp(() => ({
      pages: [
        {
          id: "p1",
          fields: [
            { id: "code", type: "input", kind: "text", label: "Code" },
            {
              id: "pick",
              type: "input",
              kind: "select",
              label: "Pick",
              options: [],
              optionsFormula: {
                inputs: { input1: { kind: "field" as const, fieldId: "code" } },
                formula: "[{ label: 'A', value: (input1 ?? 'ab').slice(1) }]",
              },
            },
          ],
        },
      ],
      outputViews: [],
    }));

    await submitAsGuest({ code: "z", pick: "a" }).expect(400);
    const response = await submitAsGuest({ code: "z", pick: "" }).expect(201);

    expect(response.body.formulaChoices).toEqual({});
  });

  it("serves the choices a response saved in its submitted history", async () => {
    const { source, destination, submit } = await setUp(pickSchema);
    const first = await respondToSource(source, ["red"]);
    await submit({
      answers: { pick: "red" },
      formulaSources: [{ formId: source.formId, responseIds: [first] }],
    }).expect(201);

    const history = await request(ctx.app.getHttpServer())
      .get(`/tasks/myResponseHistory/${destination.formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(history.body.responses[0].formulaChoices).toEqual({
      pick: [{ label: "Red", value: "red" }],
    });
  });
});
