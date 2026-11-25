/* alliance/max-lines 650 -- baseline: past the limit when the ratchet was adopted, not judged one unit */
import { recognitionCopySchema } from "@alliance/common/action-update-copy";
import { ActionActivityType } from "@alliance/common/actionActivity";
import { R } from "@alliance/common/result";
import { addDays } from "date-fns";
import { ActionUpdateRecognitionWorker } from "src/actions/action-update-recognition.worker";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionUpdateExposure } from "src/actions/entities/action-update-exposure.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
} from "src/actions/entities/action-update.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { Project } from "src/actions/entities/project.entity";
import {
  MessageChannel,
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import { Mail } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { Mms } from "src/mms/mms.entity";
import { MmsService } from "src/mms/mms.service";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationChannel } from "src/notifs/notif-utils";
import { Push } from "src/push/push.entity";
import { User } from "src/user/entities/user.entity";
import { SendErrorKind } from "src/utils/send-error";
import {
  setUpRecognition,
  type RecognitionFixture,
} from "./action-update-recognition-fixtures";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import {
  closeTestApp,
  setPreference,
  type TestContext,
} from "./e2e-test-utils";

const refusal = Object.assign(new Error("rejected"), {
  code: "EENVELOPE",
  responseCode: 550,
  command: "RCPT TO",
});

describe("action update recognition (e2e)", () => {
  let ctx: TestContext;
  let recognition: RecognitionFixture["recognition"];
  let action: RecognitionFixture["action"];
  let audience: RecognitionFixture["audience"];
  let admin: RecognitionFixture["admin"];
  let createMember: RecognitionFixture["createMember"];
  let complete: RecognitionFixture["complete"];
  let createUpdate: RecognitionFixture["createUpdate"];
  let notify: RecognitionFixture["notify"];
  let exposureOf: RecognitionFixture["exposureOf"];
  let entriesFor: RecognitionFixture["entriesFor"];
  let deliverAll: RecognitionFixture["deliverAll"];
  let reset: RecognitionFixture["reset"];

  beforeAll(async () => {
    ({
      ctx,
      recognition,
      action,
      audience,
      admin,
      createMember,
      complete,
      createUpdate,
      notify,
      exposureOf,
      entriesFor,
      deliverAll,
      reset,
    } = await setUpRecognition());
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  beforeEach(() => reset());

  it("sends every member the collective result as written, on each channel", async () => {
    const completer = await createMember();
    const nonCompleter = await createMember();
    const outsider = await createMember({ inAudience: false });
    await complete(completer);
    await complete(outsider);

    const id = await createUpdate();
    await notify(id).expect(200);
    await deliverAll();

    const entries = await entriesFor(id);
    expect(
      new Map(entries.map((entry) => [entry.user?.id, entry.content])),
    ).toEqual(
      new Map([
        [completer.id, { message: ["a hearing on the bill"] }],
        [nonCompleter.id, { message: ["a hearing on the bill"] }],
      ]),
    );
    expect(entries.every((entry) => !entry.shouldPush)).toBe(true);

    const exposure = await exposureOf(id, completer.id);
    expect(exposure.completed).toBe(true);
    expect((await exposureOf(id, nonCompleter.id)).completed).toBe(false);
    expect(exposure.deliveredAt).not.toBeNull();
    expect(exposure.mms?.body).toMatch(
      /^Update: a hearing on the bill \S+\/actions\/\d+\?cid=/,
    );
    expect(exposure.mms?.body.endsWith(`?cid=${exposure.mms?.cid}`)).toBe(true);
    expect(
      await ctx.dataSource
        .getRepository(MessageTracking)
        .findOneByOrFail({ trackingId: exposure.mms?.cid ?? "" }),
    ).toMatchObject({
      channel: MessageChannel.Sms,
      source: MessageSource.ActionUpdate,
      userId: completer.id,
      context: { actionId: expect.any(Number), actionUpdateId: id },
    });
    const copy = recognitionCopySchema.parse(exposure.copy);
    expect(copy.emailSubject).toBe(
      "Alliance progress update: Write to your representative",
    );
    expect(copy.emailBody).toContain("a hearing on the bill\n\n## Body\n\n");
    expect(exposure.mail?.to).toBe(completer.email);
    const pushes = await ctx.dataSource
      .getRepository(Push)
      .findBy({ unreadContent: { id: exposure.unreadContentId ?? -1 } });
    expect(pushes.map((push) => push.body)).toEqual([
      "Update: a hearing on the bill",
    ]);

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
      await ctx.dataSource.getRepository(Mail).countBy({ to: completer.email }),
    ).toBe(1);
    expect(
      await ctx.dataSource
        .getRepository(Mms)
        .countBy({ to: completer.phoneNumber ?? "" }),
    ).toBe(1);
    expect(
      await ctx.dataSource
        .getRepository(Push)
        .countBy({ unreadContent: { id: exposure.unreadContentId ?? -1 } }),
    ).toBe(1);
  });

  it("sends the didn't-complete text to uninvolved members, and skips a group left empty", async () => {
    const completer = await createMember();
    const nonCompleter = await createMember({ inCohort: true });
    const uninvolved = await createMember();
    const withdrawn = await createMember({ inCohort: true });
    await complete(completer);
    await ctx.dataSource.getRepository(ActionActivity).save({
      actionId: action.id,
      userId: withdrawn.id,
      type: ActionActivityType.USER_WONT_COMPLETE,
    });
    await saveLiveCohortDecisions(ctx, [action.id]);

    const id = await createUpdate({
      shortNotifString: "",
      nonCompleterResult: "a hearing; join the next one",
    });
    await notify(id).expect(200);
    await deliverAll();

    expect(
      new Map(
        (await entriesFor(id)).map((entry) => [entry.user?.id, entry.content]),
      ),
    ).toEqual(
      new Map([
        [nonCompleter.id, { message: ["a hearing; join the next one"] }],
        [uninvolved.id, { message: ["a hearing; join the next one"] }],
        [withdrawn.id, { message: ["a hearing; join the next one"] }],
      ]),
    );
    const skipped = await ctx.dataSource
      .getRepository(ActionUpdateExposure)
      .findOneOrFail({
        where: { actionUpdateId: id, userId: completer.id },
        withDeleted: true,
      });
    expect(skipped.deletedAt).not.toBeNull();
    expect(skipped.deliveredAt).toBeNull();
  });

  it("counts an unsaved audience by group", async () => {
    const completers = [
      await createMember(),
      await createMember(),
      await createMember(),
    ];
    await createMember({ inCohort: true });
    await createMember();
    await createMember({ inAudience: false });
    for (const completer of completers) {
      await complete(completer);
    }
    await saveLiveCohortDecisions(ctx, [action.id]);
    const id = await createUpdate({ notifyType: "none", tagId: undefined });

    const counts = await admin(
      "post",
      `/actions/updates/${id}/recognition-preview-counts`,
      { notifyType: "tag", tagId: audience.id },
    ).expect(200);

    expect(counts.body).toEqual({
      completed: 3,
      didNotComplete: 1,
      uninvolved: 1,
    });
  });

  it("treats a completer who later withdrew as not completed", async () => {
    const withdrawn = await createMember();
    await complete(withdrawn);
    await ctx.dataSource.getRepository(ActionActivity).save({
      actionId: action.id,
      userId: withdrawn.id,
      type: ActionActivityType.USER_WONT_COMPLETE,
    });
    const id = await createUpdate();
    await notify(id).expect(200);

    const exposure = await exposureOf(id, withdrawn.id);
    expect(exposure.completed).toBe(false);
  });

  it("creates every new update with recognition copy", async () => {
    const id = await createUpdate();
    expect(
      (await ctx.dataSource.getRepository(ActionUpdate).findOneByOrFail({ id }))
        .notificationMode,
    ).toBe(ActionUpdateNotificationMode.Normal);
  });

  it("blocks a send with no collective result", async () => {
    await createMember();
    const id = await createUpdate({
      shortNotifString: "",
      nonCompleterResult: "",
    });
    expect((await notify(id).expect(400)).body.message).toBe(
      "Write at least one group's result.",
    );
  });

  it("holds a scheduled send that turns invalid, then delivers it once repaired", async () => {
    const member = await createMember();
    const due = addDays(new Date(), 14);
    const id = await createUpdate({ date: due.toISOString() });
    await notify(id).expect(200);
    expect(await entriesFor(id)).toHaveLength(0);

    await ctx.dataSource.getRepository(ActionUpdate).update(id, {
      shortNotifString: "",
      nonCompleterResult: "",
      // Delivery runs at the real now, when an update published at `due` is still hidden.
      visibleAt: new Date(),
    });
    expect((await recognition.prepare(id, due)).ok).toBe(false);
    const held = await ctx.dataSource
      .getRepository(ActionUpdate)
      .findOneByOrFail({ id });
    expect(held.notificationHeldReason).toBe(
      "Write at least one group's result.",
    );
    expect(await entriesFor(id)).toHaveLength(0);
    await deliverAll();
    expect((await exposureOf(id, member.id)).deliveryClaimedAt).toBeNull();

    await ctx.dataSource
      .getRepository(ActionUpdate)
      .update(id, { nonCompleterResult: "a hearing while you were away" });
    expect((await recognition.prepare(id, due)).ok).toBe(true);
    expect((await recognition.prepare(id, due)).ok).toBe(true);
    await deliverAll();

    const exposure = await exposureOf(id, member.id);
    expect(recognitionCopySchema.parse(exposure.copy).inApp).toBe(
      "a hearing while you were away",
    );
    expect(exposure.mail).not.toBeNull();
    expect(await entriesFor(id)).toHaveLength(1);
    expect(
      (await ctx.dataSource.getRepository(ActionUpdate).findOneByOrFail({ id }))
        .notificationHeldReason,
    ).toBeNull();
  });

  it("names the action's project in the email when it has one", async () => {
    const member = await createMember();
    const project = await ctx.dataSource
      .getRepository(Project)
      .save({ name: "Recognition project", category: [] });
    await ctx.dataSource
      .getRepository(Action)
      .update(action.id, { project: { id: project.id } });
    try {
      const id = await createUpdate();
      await notify(id).expect(200);
      await deliverAll();
      expect(
        recognitionCopySchema.parse((await exposureOf(id, member.id)).copy)
          .emailSubject,
      ).toBe("Alliance progress update: Recognition project");
    } finally {
      await ctx.dataSource
        .getRepository(Action)
        .update(action.id, { project: null });
      await ctx.dataSource.getRepository(Project).delete(project.id);
    }
  });

  it("freezes copy at the snapshot, so later edits leave every channel alone", async () => {
    const member = await createMember();
    const id = await createUpdate();
    await notify(id).expect(200);

    await admin("patch", `/actions/updateUpdate/${id}`, {
      shortNotifString: "something else",
    }).expect(200);
    await deliverAll();

    const exposure = await exposureOf(id, member.id);
    expect(exposure.unreadContent?.content).toEqual({
      message: ["a hearing on the bill"],
    });
    expect(exposure.mms?.body).toMatch(/^Update: a hearing on the bill /);
  });

  const turnOff = (userId: number, channels: NotificationChannel[]) =>
    Promise.all(
      channels.map((channel) =>
        setPreference(ctx, {
          userId,
          kind: NotificationKind.ActionUpdates,
          channel,
          enabled: false,
        }),
      ),
    );

  it.each([
    [
      "with every channel off by default",
      (userId: number) =>
        ctx.dataSource.getRepository(User).update(userId, {
          emailByDefault: false,
          textByDefault: false,
          pushByDefault: false,
        }),
    ],
    [
      "with every channel off for action updates",
      (userId: number) =>
        turnOff(userId, [
          NotificationChannel.Push,
          NotificationChannel.Text,
          NotificationChannel.Email,
        ]),
    ],
  ] as const)("reaches a member %s on no channel", async (_, setUp) => {
    const member = await createMember();
    await setUp(member.id);
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

  it.each([
    NotificationChannel.Push,
    NotificationChannel.Text,
    NotificationChannel.Email,
  ])(
    "skips only %p when the member turned it off for action updates",
    async (off) => {
      const member = await createMember();
      await turnOff(member.id, [off]);
      const id = await createUpdate();
      await notify(id).expect(200);
      await deliverAll();

      const exposure = await exposureOf(id, member.id);
      const pushes = await ctx.dataSource
        .getRepository(Push)
        .countBy({ unreadContent: { id: exposure.unreadContentId ?? -1 } });
      expect({
        [NotificationChannel.Push]: pushes > 0,
        [NotificationChannel.Text]: exposure.mms !== null,
        [NotificationChannel.Email]: exposure.mail !== null,
      }).toEqual({
        [NotificationChannel.Push]: off !== NotificationChannel.Push,
        [NotificationChannel.Text]: off !== NotificationChannel.Text,
        [NotificationChannel.Email]: off !== NotificationChannel.Email,
      });
    },
  );

  it("reaches a member whose in-app entry is hidden by their setting", async () => {
    const member = await createMember();
    await turnOff(member.id, [NotificationChannel.InApp]);
    const id = await createUpdate();
    await notify(id).expect(200);
    await deliverAll();

    const exposure = await exposureOf(id, member.id);
    expect(exposure.unreadContent?.visible).toBe(false);
    expect(exposure.hiddenAt).toBeNull();
    expect(exposure.mms).not.toBeNull();
    expect(exposure.mail).not.toBeNull();
    expect(
      await ctx.dataSource
        .getRepository(Push)
        .countBy({ unreadContent: { id: exposure.unreadContentId ?? -1 } }),
    ).toBeGreaterThan(0);
  });

  it("records a recipient who can't see the entry at delivery as hidden, and reaches them on no channel", async () => {
    const member = await createMember();
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
    const failing = await createMember();
    const next = await createMember();
    const id = await createUpdate();
    await notify(id).expect(200);
    const mail = ctx.app.get(MailService);
    const send = jest
      .spyOn(mail, "sendCustomHtmlEmail")
      .mockRejectedValueOnce(refusal);
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
    const first = await createMember();
    const retaken = await createMember();
    const id = await createUpdate();
    await notify(id).expect(200);
    const mms = ctx.app.get(MmsService);
    const sendMmsResult = mms.sendMmsResult.bind(mms);
    const send = jest
      .spyOn(mms, "sendMmsResult")
      .mockImplementationOnce(async (params) => {
        await ctx.dataSource.query(
          `UPDATE action_update_exposure SET "deliveryClaimedAt" = now() + interval '1 second' WHERE "userId" = $1`,
          [retaken.id],
        );
        return sendMmsResult(params);
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

  it("reaches no channel for a recipient deleted after this batch's claim", async () => {
    const first = await createMember();
    const deleted = await createMember();
    const id = await createUpdate();
    await notify(id).expect(200);
    const mms = ctx.app.get(MmsService);
    const sendMmsResult = mms.sendMmsResult.bind(mms);
    const send = jest
      .spyOn(mms, "sendMmsResult")
      .mockImplementationOnce(async (params) => {
        await ctx.dataSource.query(
          `UPDATE action_update_exposure SET "deletedAt" = now() WHERE "userId" = $1`,
          [deleted.id],
        );
        return sendMmsResult(params);
      });
    try {
      await recognition.deliverPrepared();
    } finally {
      send.mockRestore();
    }

    expect((await exposureOf(id, first.id)).deliveredAt).not.toBeNull();
    const skipped = await ctx.dataSource
      .getRepository(ActionUpdateExposure)
      .findOneOrFail({
        where: { actionUpdateId: id, userId: deleted.id },
        relations: { mms: true },
        withDeleted: true,
      });
    expect(skipped.deliveredAt).toBeNull();
    expect(skipped.mms).toBeNull();
  });

  it.each([
    { send: "both are refused", text: SendErrorKind.Refused, email: refusal },
    {
      send: "their outcome is unknown",
      text: SendErrorKind.Unknown,
      email: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
    },
    { send: "the text is refused", text: SendErrorKind.Refused, email: null },
  ])(
    "marks a text and an email failed only when provably not sent, and resends neither when $send",
    async ({ text, email }) => {
      const member = await createMember();
      const id = await createUpdate();
      await notify(id).expect(200);
      const texts = jest
        .spyOn(ctx.app.get(MmsService), "sendMmsResult")
        .mockResolvedValueOnce(R.failure(text));
      const mail = ctx.app.get(MailService);
      const emails = jest.spyOn(mail, "sendCustomHtmlEmail");
      if (email) emails.mockRejectedValueOnce(email);
      try {
        await deliverAll();
        await ctx.dataSource.query(
          `UPDATE action_update_exposure SET "deliveredAt" = NULL, "deliveryClaimedAt" = NULL WHERE "userId" = $1`,
          [member.id],
        );
        await deliverAll();
        expect(texts).toHaveBeenCalledTimes(1);
        expect(emails).toHaveBeenCalledTimes(1);
      } finally {
        texts.mockRestore();
        emails.mockRestore();
      }

      const exposure = await exposureOf(id, member.id);
      const refused = text === SendErrorKind.Refused;
      expect(exposure.mms).toBeNull();
      expect(exposure.mail === null).toBe(email !== null);
      expect(exposure.textStartedAt).not.toBeNull();
      expect(exposure.emailStartedAt).not.toBeNull();
      expect(exposure.textFailedAt !== null).toBe(refused);
      expect(exposure.emailFailedAt !== null).toBe(refused && email !== null);
    },
  );

  it("prepares scheduled updates once due, and never legacy ones", async () => {
    const member = await createMember();
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
    const member = await createMember();
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
    await createMember();
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
