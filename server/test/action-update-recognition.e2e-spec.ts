import { ActionActivityType } from "@alliance/common/actionActivity";
import { addDays, milliseconds } from "date-fns";
import { ActionUpdateRecognitionService } from "src/actions/action-update-recognition.service";
import { ActionUpdateRecognitionWorker } from "src/actions/action-update-recognition.worker";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import {
  ActionUpdateExposure,
  RecognitionBranch,
  recognitionCopySchema,
} from "src/actions/entities/action-update-exposure.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
} from "src/actions/entities/action-update.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import {
  MessageChannel,
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import { Mail } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { Mms } from "src/mms/mms.entity";
import { MmsService } from "src/mms/mms.service";
import {
  Experiment,
  ExperimentArm,
  ExperimentAssignment,
} from "src/notifs/entities/experiment-assignment.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { Push } from "src/push/push.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { Tag } from "src/user/entities/tag.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import request from "supertest";
import {
  createFormWithSnapshot,
  createTestApp,
  giveActiveContract,
  stubExpoClient,
  type TestContext,
} from "./e2e-test-utils";

const lettersFormula = (formula: string) => ({
  inputs: { input1: { kind: "field", fieldId: "letters" } },
  formula,
});
const LETTERS = lettersFormula('input1 + " letters"');
const LETTERS_OR_SOME = lettersFormula('(input1 ?? "some") + " letters"');

describe("action update recognition (e2e)", () => {
  let ctx: TestContext;
  let recognition: ActionUpdateRecognitionService;
  let action: Action;
  let audience: Tag;
  let formId: number;
  let formSnapshotId: number;
  let memberCount = 0;

  const admin = (
    method: "post" | "patch",
    path: string,
    body?: Record<string, unknown>,
  ) =>
    request(ctx.app.getHttpServer())
      [method](path)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  const createMember = async (params: {
    arm: ExperimentArm;
    inAudience?: boolean;
  }) => {
    const index = ++memberCount;
    const users = ctx.dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        email: `recognition-${index}@example.com`,
        password: "pass",
        name: `Member${index} Example`,
        referralSource: ReferralSource.None,
        phoneNumber: `+1415555${String(1000 + index)}`,
        tags: params.inAudience === false ? [] : [audience],
      }),
    );
    await giveActiveContract(ctx, user.id);
    await ctx.dataSource.getRepository(UserDevice).save({
      user: { id: user.id },
      expoPushToken: `ExponentPushToken[recognition-${index}]`,
    });
    await ctx.dataSource.getRepository(ExperimentAssignment).save({
      userId: user.id,
      experiment: Experiment.ActionUpdateRecognition,
      arm: params.arm,
    });
    return user;
  };

  const complete = async (
    user: User,
    params: { letters?: number; daysAgo?: number } = {},
  ) => {
    const response =
      params.letters === undefined
        ? undefined
        : await ctx.dataSource.getRepository(FormResponse).save({
            formId,
            formSnapshotId,
            user: { id: user.id },
            answers: { letters: params.letters },
          });
    const activity = await ctx.dataSource.getRepository(ActionActivity).save({
      actionId: action.id,
      userId: user.id,
      type: ActionActivityType.USER_COMPLETED,
      taskFormResponse: response,
    });
    if (params.daysAgo !== undefined) {
      await ctx.dataSource.getRepository(ActionActivity).update(activity.id, {
        createdAt: addDays(new Date(), -params.daysAgo),
      });
    }
  };

  const setAnswers = (user: User, answers: Record<string, number>) =>
    ctx.dataSource.query(
      'UPDATE form_response SET answers = $1 WHERE "userId" = $2',
      [answers, user.id],
    );

  const createUpdate = async (body: Record<string, unknown> = {}) => {
    const created = await admin("post", `/actions/createUpdate/${action.id}`, {
      title: "Recognition",
      shortNotifString: "a hearing on the bill",
      date: new Date(Date.now() - milliseconds({ minutes: 1 })).toISOString(),
      notifyType: "tag",
      tagId: audience.id,
      notificationMode: "normal",
      contributionFormula: LETTERS,
      ...body,
    }).expect(201);
    await admin("patch", `/actions/updateUpdate/${created.body.id}`, {
      schema: {
        blocks: [{ type: "display", kind: "header", id: "b1", text: "Body" }],
      },
      expectedSchemaSnapshotId: created.body.schemaSnapshotId,
    }).expect(200);
    const id: number = created.body.id;
    return id;
  };

  const notify = (id: number) => admin("post", `/actions/updates/${id}/notify`);

  const exposureOf = (updateId: number, userId: number) =>
    ctx.dataSource.getRepository(ActionUpdateExposure).findOneOrFail({
      where: { actionUpdateId: updateId, userId },
      relations: { mail: true, mms: true, unreadContent: true },
    });

  const entriesFor = (updateId: number) =>
    ctx.dataSource.getRepository(UnreadContent).find({
      where: {
        contentType: UnreadContentType.ActionUpdate,
        contentId: updateId,
      },
      relations: { user: true },
    });

  const deliverAll = async () => {
    let more = true;
    while (more) {
      more = await recognition.deliverPrepared();
    }
  };

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
    stubExpoClient(ctx);
    recognition = ctx.app.get(ActionUpdateRecognitionService);
    audience = await ctx.dataSource
      .getRepository(Tag)
      .save({ name: "Recognition audience", description: "" });
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Letters form",
      schema: {
        pages: [
          {
            id: "p1",
            fields: [
              {
                id: "letters",
                type: "input",
                kind: "number",
                label: "Letters",
              },
            ],
          },
        ],
      },
    });
    formId = form.id;
    formSnapshotId = snapshot.id;
    action = await ctx.dataSource.getRepository(Action).save({
      name: "Write to your representative",
      category: [],
      body: "Body",
      shortDescription: "Short",
      visibilityMode: VisibilityMode.Public,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      taskFormId: form.id,
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Launch",
      description: "Live",
      newStatus: ActionStatus.MemberAction,
      date: addDays(new Date(), -30),
      action,
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.query("DELETE FROM action_update");
    await ctx.dataSource.query("DELETE FROM action_activity");
    await ctx.dataSource.query(
      'DELETE FROM tag_users_user WHERE "tagId" = $1',
      [audience.id],
    );
  });

  it("sends A to variant completers and B to everyone else in the audience, on each channel", async () => {
    const variant = await createMember({ arm: ExperimentArm.Variant });
    const control = await createMember({ arm: ExperimentArm.Control });
    const nonCompleter = await createMember({ arm: ExperimentArm.Variant });
    const adminRecorded = await createMember({ arm: ExperimentArm.Variant });
    const outsider = await createMember({
      arm: ExperimentArm.Variant,
      inAudience: false,
    });
    await complete(variant, { letters: 3 });
    await complete(control, { letters: 5 });
    await complete(adminRecorded);
    await complete(outsider, { letters: 2 });

    const id = await createUpdate({ contributionFormula: LETTERS_OR_SOME });
    await notify(id).expect(200);
    await deliverAll();

    const entries = await entriesFor(id);
    expect(
      new Map(entries.map((entry) => [entry.user?.id, entry.content])),
    ).toEqual(
      new Map([
        [
          variant.id,
          { message: ["Your 3 letters led to a hearing on the bill."] },
        ],
        [control.id, { message: ["a hearing on the bill"] }],
        [nonCompleter.id, { message: ["a hearing on the bill"] }],
        [
          adminRecorded.id,
          { message: ["Your some letters led to a hearing on the bill."] },
        ],
      ]),
    );
    expect(entries.every((entry) => !entry.shouldPush)).toBe(true);

    const a = await exposureOf(id, variant.id);
    expect(a).toMatchObject({
      mode: ActionUpdateNotificationMode.Normal,
      assignedArm: ExperimentArm.Variant,
      completed: true,
      branch: RecognitionBranch.A,
      contribution: "3 letters",
    });
    expect(a.deliveredAt).not.toBeNull();
    expect(a.mms?.body).toMatch(
      /^Your 3 letters led to a hearing on the bill\. \S+\/actions\/\d+\?cid=/,
    );
    expect(a.mms?.body.endsWith(`?cid=${a.mms?.cid}`)).toBe(true);
    expect(
      await ctx.dataSource
        .getRepository(MessageTracking)
        .findOneByOrFail({ trackingId: a.mms?.cid ?? "" }),
    ).toMatchObject({
      channel: MessageChannel.Sms,
      source: MessageSource.ActionUpdate,
      userId: variant.id,
      context: { actionId: expect.any(Number), actionUpdateId: id },
    });
    expect(recognitionCopySchema.parse(a.copy).emailSubject).toBe(
      "Your 3 letters led to a hearing on the bill.",
    );
    expect(a.mail?.to).toBe(variant.email);
    const pushes = await ctx.dataSource
      .getRepository(Push)
      .findBy({ unreadContent: { id: a.unreadContentId ?? -1 } });
    expect(pushes.map((push) => push.body)).toEqual([
      "Your 3 letters led to a hearing on the bill.",
    ]);

    expect(await exposureOf(id, control.id)).toMatchObject({
      assignedArm: ExperimentArm.Control,
      completed: true,
      branch: RecognitionBranch.B,
    });
    const b = await exposureOf(id, nonCompleter.id);
    expect(b).toMatchObject({
      assignedArm: ExperimentArm.Variant,
      completed: false,
      branch: RecognitionBranch.B,
    });
    expect(b.mms?.body).toMatch(/^Update: a hearing on the bill \S+/);
    expect(recognitionCopySchema.parse(b.copy).emailSubject).toBe(
      "a hearing on the bill",
    );

    expect(
      await ctx.dataSource
        .getRepository(ActionUpdateExposure)
        .countBy({ actionUpdateId: id, userId: outsider.id }),
    ).toBe(0);

    await notify(id).expect(409);
    await ctx.dataSource
      .getRepository(ActionUpdateExposure)
      .update(
        { actionUpdateId: id },
        { deliveredAt: null, deliveryClaimedAt: addDays(new Date(), -1) },
      );
    await deliverAll();
    expect(
      await ctx.dataSource.getRepository(Mail).countBy({ to: variant.email }),
    ).toBe(1);
    expect(
      await ctx.dataSource
        .getRepository(Mms)
        .countBy({ to: variant.phoneNumber ?? "" }),
    ).toBe(1);
    expect(
      await ctx.dataSource
        .getRepository(Push)
        .countBy({ unreadContent: { id: a.unreadContentId ?? -1 } }),
    ).toBe(1);
  });

  it("sends B to a completer who later withdrew", async () => {
    const withdrawn = await createMember({ arm: ExperimentArm.Variant });
    await complete(withdrawn, { letters: 3, daysAgo: 2 });
    await ctx.dataSource.getRepository(ActionActivity).save({
      actionId: action.id,
      userId: withdrawn.id,
      type: ActionActivityType.USER_WONT_COMPLETE,
    });
    const id = await createUpdate();
    await notify(id).expect(200);

    const exposure = await exposureOf(id, withdrawn.id);
    expect(exposure.completed).toBe(false);
    expect(exposure.branch).toBe(RecognitionBranch.B);
  });

  it("draws a member's arm once and keeps it across updates", async () => {
    const member = await createMember({ arm: ExperimentArm.Control });
    await ctx.dataSource
      .getRepository(ExperimentAssignment)
      .delete({ userId: member.id });

    await notify(await createUpdate()).expect(200);
    const [{ arm }] = await ctx.dataSource
      .getRepository(ExperimentAssignment)
      .findBy({
        userId: member.id,
        experiment: Experiment.ActionUpdateRecognition,
      });

    await complete(member, { letters: 1 });
    const second = await createUpdate();
    await notify(second).expect(200);
    expect(
      await ctx.dataSource.getRepository(ExperimentAssignment).findBy({
        userId: member.id,
        experiment: Experiment.ActionUpdateRecognition,
      }),
    ).toEqual([expect.objectContaining({ arm })]);
    expect((await exposureOf(second, member.id)).assignedArm).toBe(arm);
  });

  it("refuses legacy copy on new updates, and recognition copy on old ones", async () => {
    const legacy = {
      title: "Legacy",
      shortNotifString: "x",
      date: new Date().toISOString(),
      notifyType: "none",
    };
    await admin("post", `/actions/createUpdate/${action.id}`, legacy).expect(
      400,
    );
    await admin("post", `/actions/createUpdate/${action.id}`, {
      ...legacy,
      notificationMode: "legacy",
    }).expect(400);

    const id = await createUpdate();
    await admin("patch", `/actions/updateUpdate/${id}`, {
      notificationMode: "legacy",
    }).expect(400);
    await ctx.dataSource
      .getRepository(ActionUpdate)
      .update(id, { notificationMode: ActionUpdateNotificationMode.Legacy });
    await admin("patch", `/actions/updateUpdate/${id}`, {
      notificationMode: "normal",
    }).expect(400);
  });

  it("refuses a malformed formula, or one reading another form, on create and update", async () => {
    const otherForm = {
      inputs: {
        input1: {
          kind: "sourceField",
          sourceFormId: formId,
          fieldId: "letters",
        },
      },
      formula: "input1",
    };
    const malformed = { formula: 7 };
    for (const contributionFormula of [otherForm, malformed]) {
      await admin("post", `/actions/createUpdate/${action.id}`, {
        title: "Recognition",
        shortNotifString: "x",
        date: new Date().toISOString(),
        notifyType: "none",
        notificationMode: "normal",
        contributionFormula,
      }).expect(400);
    }

    const id = await createUpdate();
    for (const retrospectiveContributionFormula of [otherForm, malformed]) {
      await admin("patch", `/actions/updateUpdate/${id}`, {
        retrospectiveContributionFormula,
      }).expect(400);
    }
    const stored = await ctx.dataSource
      .getRepository(ActionUpdate)
      .findOneByOrFail({ id });
    expect(stored.retrospectiveContributionFormula).toBeNull();
    expect(stored.contributionFormula).toEqual(LETTERS);
  });

  it("blocks a send on an A recipient's broken contribution, and names them", async () => {
    const variant = await createMember({ arm: ExperimentArm.Variant });
    const control = await createMember({ arm: ExperimentArm.Control });
    await complete(variant);
    await complete(control);
    const id = await createUpdate({
      retrospectiveContributionFormula: lettersFormula("(("),
    });

    const check = await admin(
      "post",
      `/actions/updates/${id}/recognition-check`,
    ).expect(200);
    expect(check.body).toEqual({
      problems: [],
      collectiveSubject: "a hearing on the bill",
      members: [
        {
          userId: variant.id,
          name: variant.name,
          error: "The formula resolves to empty text.",
        },
      ],
    });
    await notify(id).expect(400);
    expect(await entriesFor(id)).toHaveLength(0);

    await admin("patch", `/actions/updateUpdate/${id}`, {
      contributionFormula: LETTERS_OR_SOME,
    }).expect(200);
    await notify(id).expect(200);
    expect((await exposureOf(id, variant.id)).branch).toBe(RecognitionBranch.A);
  });

  it("blocks a send on missing configuration or a formula that doesn't compile", async () => {
    await createMember({ arm: ExperimentArm.Control });
    const id = await createUpdate({
      contributionFormula: lettersFormula("(("),
    });
    const response = await notify(id).expect(400);
    expect(response.body.message).toMatch(/doesn't compile/);

    await admin("patch", `/actions/updateUpdate/${id}`, {
      notificationMode: "retrospective",
    }).expect(200);
    expect((await notify(id).expect(400)).body.message).toMatch(
      /Write the retrospective contribution formula/,
    );
  });

  it("holds a scheduled send that turns invalid, then delivers it once repaired", async () => {
    const variant = await createMember({ arm: ExperimentArm.Variant });
    await complete(variant, { letters: 3, daysAgo: 1 });
    const due = addDays(new Date(), 14);
    const id = await createUpdate({
      date: due.toISOString(),
      notificationMode: "retrospective",
      retrospectiveContributionFormula: lettersFormula(
        '"sent " + input1 + " letters"',
      ),
    });
    await notify(id).expect(200);
    expect(await entriesFor(id)).toHaveLength(0);

    await setAnswers(variant, {});
    expect((await recognition.prepare(id, due)).ok).toBe(false);
    const held = await ctx.dataSource
      .getRepository(ActionUpdate)
      .findOneByOrFail({ id });
    expect(held.notificationHeldReason).toMatch(/1 member/);
    expect(await entriesFor(id)).toHaveLength(0);
    await deliverAll();
    expect((await exposureOf(id, variant.id)).deliveryClaimedAt).toBeNull();

    await setAnswers(variant, { letters: 4 });
    expect((await recognition.prepare(id, due)).ok).toBe(true);
    expect((await recognition.prepare(id, due)).ok).toBe(true);
    await deliverAll();

    const exposure = await exposureOf(id, variant.id);
    expect(exposure).toMatchObject({
      branch: RecognitionBranch.A,
      assignedArm: ExperimentArm.Variant,
      weeksAgo: 2,
      contribution: "sent 4 letters",
    });
    expect(recognitionCopySchema.parse(exposure.copy).emailSubject).toBe(
      "2 weeks ago you sent 4 letters.",
    );
    expect(exposure.mail).not.toBeNull();
    expect(await entriesFor(id)).toHaveLength(1);
    expect(
      (await ctx.dataSource.getRepository(ActionUpdate).findOneByOrFail({ id }))
        .notificationHeldReason,
    ).toBeNull();
  });

  it("freezes copy at the snapshot, so later edits leave every channel alone", async () => {
    const variant = await createMember({ arm: ExperimentArm.Variant });
    await complete(variant, { letters: 3 });
    const id = await createUpdate();
    await notify(id).expect(200);

    await setAnswers(variant, { letters: 9 });
    await admin("patch", `/actions/updateUpdate/${id}`, {
      shortNotifString: "something else",
    }).expect(200);
    await deliverAll();

    const exposure = await exposureOf(id, variant.id);
    expect(exposure.unreadContent?.content).toEqual({
      message: ["Your 3 letters led to a hearing on the bill."],
    });
    expect(exposure.mms?.body).toMatch(
      /^Your 3 letters led to a hearing on the bill\. /,
    );

    await setAnswers(variant, {});
    const check = await admin(
      "post",
      `/actions/updates/${id}/recognition-check`,
    ).expect(200);
    expect(check.body.members).toEqual([]);
  });

  it("sends only on the channels a member has enabled", async () => {
    const member = await createMember({ arm: ExperimentArm.Control });
    await ctx.dataSource.getRepository(User).update(member.id, {
      emailNotifsForActions: false,
      textNotifsForActions: false,
      pushesForActionUpdates: false,
    });
    const id = await createUpdate();
    await notify(id).expect(200);
    await deliverAll();

    const exposure = await exposureOf(id, member.id);
    expect(exposure.deliveredAt).not.toBeNull();
    expect(exposure.hiddenAt).toBeNull();
    expect(exposure.mail).toBeNull();
    expect(exposure.mms).toBeNull();
    expect(
      await ctx.dataSource
        .getRepository(Push)
        .countBy({ unreadContent: { id: exposure.unreadContentId ?? -1 } }),
    ).toBe(0);
    expect(exposure.unreadContent).not.toBeNull();
  });

  it("records a recipient who can't see the entry at delivery as hidden, and reaches them on no channel", async () => {
    const member = await createMember({ arm: ExperimentArm.Control });
    const id = await createUpdate();
    await notify(id).expect(200);
    await ctx.dataSource.getRepository(Action).update(action.id, {
      visibilityMode: VisibilityMode.ParticipatingGroups,
    });
    try {
      await deliverAll();
    } finally {
      await ctx.dataSource
        .getRepository(Action)
        .update(action.id, { visibilityMode: VisibilityMode.Public });
    }

    const exposure = await exposureOf(id, member.id);
    expect(exposure.hiddenAt).not.toBeNull();
    expect(exposure.mail).toBeNull();
    expect(exposure.mms).toBeNull();
    expect(
      await ctx.dataSource
        .getRepository(Push)
        .countBy({ unreadContent: { id: exposure.unreadContentId ?? -1 } }),
    ).toBe(0);
  });

  it("keeps delivering a batch past a recipient whose email fails, and doesn't retry that email", async () => {
    const failing = await createMember({ arm: ExperimentArm.Control });
    const next = await createMember({ arm: ExperimentArm.Control });
    const id = await createUpdate();
    await notify(id).expect(200);
    const mail = ctx.app.get(MailService);
    const send = jest
      .spyOn(mail, "sendActionEventNotificationEmail")
      .mockRejectedValueOnce(new Error("rejected"));
    try {
      await deliverAll();
    } finally {
      send.mockRestore();
    }

    const failed = await exposureOf(id, failing.id);
    expect(failed.deliveredAt).not.toBeNull();
    expect(failed.mail).toBeNull();
    expect(failed.emailFailedAt).not.toBeNull();
    expect(failed.mms).not.toBeNull();
    const delivered = await exposureOf(id, next.id);
    expect(delivered.deliveredAt).not.toBeNull();
    expect(delivered.mail).not.toBeNull();
  });

  it("skips a recipient another run retook after this batch's claim expired", async () => {
    const first = await createMember({ arm: ExperimentArm.Control });
    const retaken = await createMember({ arm: ExperimentArm.Control });
    const id = await createUpdate();
    await notify(id).expect(200);
    const mms = ctx.app.get(MmsService);
    const sendMms = mms.sendMms.bind(mms);
    const send = jest
      .spyOn(mms, "sendMms")
      .mockImplementationOnce(async (params) => {
        await ctx.dataSource.query(
          `UPDATE action_update_exposure SET "deliveryClaimedAt" = now() + interval '1 second' WHERE "userId" = $1`,
          [retaken.id],
        );
        return sendMms(params);
      });
    try {
      await recognition.deliverPrepared();
    } finally {
      send.mockRestore();
    }

    expect((await exposureOf(id, first.id)).deliveredAt).not.toBeNull();
    const skipped = await exposureOf(id, retaken.id);
    expect(skipped.deliveredAt).toBeNull();
    expect(skipped.mms).toBeNull();
  });

  it("records a failed text apart from one never attempted", async () => {
    const member = await createMember({ arm: ExperimentArm.Control });
    const id = await createUpdate();
    await notify(id).expect(200);
    const send = jest
      .spyOn(ctx.app.get(MmsService), "sendMms")
      .mockResolvedValueOnce(null);
    try {
      await deliverAll();
    } finally {
      send.mockRestore();
    }

    const exposure = await exposureOf(id, member.id);
    expect(exposure.mms).toBeNull();
    expect(exposure.textFailedAt).not.toBeNull();
    expect(exposure.emailFailedAt).toBeNull();
  });

  it("prepares scheduled updates once due, and never legacy ones", async () => {
    const member = await createMember({ arm: ExperimentArm.Control });
    const due = addDays(new Date(), 3);
    const scheduled = await createUpdate({ date: due.toISOString() });
    await notify(scheduled).expect(200);
    const legacy = await createUpdate();
    await notify(legacy).expect(200);
    await ctx.dataSource.getRepository(ActionUpdate).update(legacy, {
      notificationMode: ActionUpdateNotificationMode.Legacy,
      recognitionPreparedAt: null,
    });

    await recognition.prepareDue(addDays(due, -1));
    expect(await entriesFor(scheduled)).toHaveLength(0);

    await recognition.prepareDue(due);
    expect((await exposureOf(scheduled, member.id)).preparedAt).not.toBeNull();
    expect(
      (
        await ctx.dataSource
          .getRepository(ActionUpdate)
          .findOneByOrFail({ id: legacy })
      ).recognitionPreparedAt,
    ).toBeNull();
  });

  it("runs one delivery loop at a time, however long a send takes", async () => {
    const pending: (() => void)[] = [];
    const deliver = jest
      .spyOn(recognition, "deliverPrepared")
      .mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            pending.push(() => resolve(false));
          }),
      );
    try {
      const worker = ctx.app.get(ActionUpdateRecognitionWorker);
      const first = worker.deliverPrepared();
      while (deliver.mock.calls.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const second = worker.deliverPrepared();
      await new Promise((resolve) => setTimeout(resolve, 200));
      for (const finish of pending) finish();
      await Promise.all([first, second]);
      expect(deliver).toHaveBeenCalledTimes(1);
    } finally {
      deliver.mockRestore();
    }
  });

  it("prepares the rest of the due updates past one that fails", async () => {
    const member = await createMember({ arm: ExperimentArm.Control });
    const due = addDays(new Date(), 3);
    const first = await createUpdate({ date: due.toISOString() });
    const second = await createUpdate({ date: due.toISOString() });
    await notify(first).expect(200);
    await notify(second).expect(200);
    const prepare = jest
      .spyOn(recognition, "prepare")
      .mockRejectedValueOnce(new Error("lock timeout"));
    try {
      await recognition.prepareDue(due);
    } finally {
      prepare.mockRestore();
    }
    expect((await exposureOf(first, member.id)).preparedAt).toBeNull();
    expect((await exposureOf(second, member.id)).preparedAt).not.toBeNull();

    await recognition.prepareDue(due);
    expect((await exposureOf(first, member.id)).preparedAt).not.toBeNull();
  });

  it("answers a send whose copy fails to prepare with the claimed update", async () => {
    await createMember({ arm: ExperimentArm.Control });
    const id = await createUpdate();
    const prepare = jest
      .spyOn(recognition, "prepare")
      .mockRejectedValueOnce(new Error("lock timeout"));
    try {
      const sent = await notify(id).expect(200);
      expect(sent.body.notifiedAt).not.toBeNull();
    } finally {
      prepare.mockRestore();
    }
    await recognition.prepareDue(new Date());
    expect(await entriesFor(id)).toHaveLength(1);
  });
});
