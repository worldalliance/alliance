import { AnalyticsEvent } from "@alliance/common/analytics";
import { LinkOpeningPlatform } from "@alliance/common/linkOpening";
import { randomUUID } from "crypto";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionUpdateExposure } from "src/actions/entities/action-update-exposure.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
  ActionUpdateNotifyType,
} from "src/actions/entities/action-update.entity";
import { Action } from "src/actions/entities/action.entity";
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import { LinkOpening } from "src/link-tracking/link-opening.entity";
import { LinkTrackingModule } from "src/link-tracking/link-tracking.module";
import {
  MessageChannel,
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import { EmailStatus, EmailType, Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import {
  ActionEventNotif,
  ActionEventNotifType,
} from "src/notifs/entities/action-event-notif.entity";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { PosthogService } from "src/posthog/posthog.service";
import { FormSnapshot } from "src/tasks/entities/formsnapshot.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import supertest from "supertest";
import { In } from "typeorm";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Legacy link openings (e2e)", () => {
  let ctx: TestContext;
  let member: User;

  const openings = () => ctx.dataSource.getRepository(LinkOpening);
  const trackingFor = (trackingId: string) =>
    ctx.dataSource.getRepository(MessageTracking).findOneBy({ trackingId });

  const post = (body: Record<string, unknown>) =>
    supertest(ctx.app.getHttpServer()).post("/link-openings").send(body);

  const opening = (trackingId: string) => ({
    openingId: randomUUID(),
    trackingId,
    destination: "/tasks",
    platform: LinkOpeningPlatform.Web,
    observedAt: new Date().toISOString(),
  });

  const saveMember = (email: string) => {
    const users = ctx.dataSource.getRepository(User);
    return users.save(
      users.create({
        email,
        password: "pass",
        name: "Sam Example",
        referralSource: ReferralSource.None,
      }),
    );
  };

  beforeAll(async () => {
    ctx = await createTestApp([LinkTrackingModule]);
    member = await saveMember("member@example.org");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const saveAction = () =>
    ctx.dataSource.getRepository(Action).save({
      name: "Legacy action",
      category: [],
      body: "Legacy action body",
      status: ActionStatus.MemberAction,
    });

  const saveReminderGroup = async (name: string) => {
    const action = await saveAction();
    const memberActionEvent = await ctx.dataSource
      .getRepository(ActionEvent)
      .save({
        title: "Legacy event",
        description: "desc",
        newStatus: ActionStatus.MemberAction,
        date: new Date(),
        action,
      });
    const groups = ctx.dataSource.getRepository(ReminderGroup);
    const reminderGroup = await groups.save(
      groups.create({
        name,
        memberActionEvent,
        timingMode: ReminderGroupTimingMode.EventLaunch,
        cohortType: ReminderCohortType.AllUncompleted,
        emailSubject: "Subject",
        emailMessage: "Message",
        textMessage: "Text",
        allSent: true,
      }),
    );
    return { action, memberActionEvent, reminderGroup };
  };

  const saveLegacy = async (params: {
    cid: string;
    mail: boolean;
    mms: boolean;
    notif: boolean | Partial<ActionEventNotif>;
  }) => {
    const mail = params.mail
      ? await ctx.dataSource.getRepository(Mail).save({
          to: member.email,
          status: EmailStatus.Sent,
          emailType: EmailType.CustomActionReminder,
          sentMessageId: null,
          renderedHtml: null,
          cid: params.cid,
        })
      : null;
    const mms = params.mms
      ? await ctx.dataSource.getRepository(Mms).save({
          to: "+15555550123",
          from: "+15555550100",
          body: "legacy",
          status: "sent",
          twilioSid: "legacy-sid",
          errorCode: null,
          errorMessage: null,
          cid: params.cid,
        })
      : null;
    if (params.notif) {
      await ctx.dataSource.getRepository(ActionEventNotif).save({
        user: member,
        type: ActionEventNotifType.Reminder,
        mail,
        mms,
        notifiedActionIds: [5],
        ...(params.notif === true ? {} : params.notif),
      });
    }
    return { mail, mms };
  };

  it("recovers the owner, channel, and context of a reminder's link", async () => {
    const { action, reminderGroup } =
      await saveReminderGroup("Legacy reminder");
    const notification = await ctx.dataSource.getRepository(Notification).save({
      user: member,
      category: NotificationCategory.ActionEvent,
      message: "Your tasks are waiting",
      webAppLocation: "/tasks",
    });
    const { mms } = await saveLegacy({
      cid: "0123456789",
      mail: false,
      mms: true,
      notif: { reminderGroup, notification },
    });

    await post(opening("0123456789")).expect(204);

    expect(await trackingFor("0123456789")).toMatchObject({
      channel: MessageChannel.Sms,
      legacy: true,
      userId: member.id,
      source: MessageSource.ActionReminder,
      context: {
        reminderGroupId: reminderGroup.id,
        reminderGroupName: "Legacy reminder",
        actionId: action.id,
        actionName: "Legacy action",
        notifiedActionIds: [5],
      },
    });
    const reloaded = await ctx.dataSource
      .getRepository(Mms)
      .findOneByOrFail({ id: mms!.id });
    expect(reloaded.clickedLink).toBe(true);
    expect(
      await ctx.dataSource
        .getRepository(Notification)
        .findOneByOrFail({ id: notification.id }),
    ).toMatchObject({ readAt: expect.any(Date) });
  });

  it("records racing first openings of a legacy link", async () => {
    await saveLegacy({
      cid: "0a0a0a0a0a",
      mail: true,
      mms: false,
      notif: true,
    });

    const results = await Promise.all(
      Array.from({ length: 6 }, () => post(opening("0a0a0a0a0a"))),
    );

    expect(results.map((result) => result.status)).toEqual(Array(6).fill(204));
    const tracking = await trackingFor("0a0a0a0a0a");
    expect(await openings().countBy({ messageTrackingId: tracking!.id })).toBe(
      6,
    );
  });

  it("leaves the channel unknown when an email and a text shared the ID, crediting the text as before", async () => {
    const { mail, mms } = await saveLegacy({
      cid: "aaaaaaaaaa",
      mail: true,
      mms: true,
      notif: true,
    });
    const capture = jest.spyOn(ctx.app.get(PosthogService), "capture");

    await post(opening("aaaaaaaaaa")).expect(204);

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          legacy: true,
          channel: MessageChannel.Unknown,
          platform: "mms",
        }),
      }),
    );
    capture.mockRestore();

    const tracking = await trackingFor("aaaaaaaaaa");
    expect(tracking?.channel).toBe(MessageChannel.Unknown);
    expect(await openings().countBy({ messageTrackingId: tracking!.id })).toBe(
      1,
    );
    const [reloadedMail, reloadedMms] = await Promise.all([
      ctx.dataSource.getRepository(Mail).findOneByOrFail({ id: mail!.id }),
      ctx.dataSource.getRepository(Mms).findOneByOrFail({ id: mms!.id }),
    ]);
    expect(reloadedMail.clickedLink).toBe(false);
    expect(reloadedMms.clickedLink).toBe(true);
  });

  it("rejects a legacy-shaped ID no message carried", async () => {
    await post(opening("cccccccccc")).expect(404);

    expect(await trackingFor("cccccccccc")).toBeNull();
  });

  it("stores an opening of a message with no durable owner unattributed, and reports it once under no person", async () => {
    const { mail } = await saveLegacy({
      cid: "bbbbbbbbbb",
      mail: true,
      mms: false,
      notif: false,
    });
    const capture = jest.spyOn(ctx.app.get(PosthogService), "capture");
    const body = opening("bbbbbbbbbb");

    await post(body).expect(204);
    await post(body).expect(204);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith({
      event: AnalyticsEvent.NotifLinkClick,
      distinctId: "legacy_link_bbbbbbbbbb",
      properties: expect.objectContaining({
        cid: "bbbbbbbbbb",
        platform: "email",
        legacy: true,
        $process_person_profile: false,
      }),
    });
    capture.mockRestore();
    expect(await trackingFor("bbbbbbbbbb")).toBeNull();
    expect(
      await openings().findOneByOrFail({ openingId: body.openingId }),
    ).toMatchObject({ messageTrackingId: null, destination: "/tasks" });
    const reloaded = await ctx.dataSource
      .getRepository(Mail)
      .findOneByOrFail({ id: mail!.id });
    expect(reloaded.clickedLink).toBe(true);
  });
  it("stores an opening of a deleted member's reminder unattributed", async () => {
    const deleted = await saveMember("deleted@example.org");
    const mail = await ctx.dataSource.getRepository(Mail).save({
      to: deleted.email,
      status: EmailStatus.Sent,
      emailType: EmailType.CustomActionReminder,
      sentMessageId: null,
      renderedHtml: null,
      cid: "4d4d4d4d4d",
    });
    await ctx.dataSource.getRepository(ActionEventNotif).save({
      user: deleted,
      type: ActionEventNotifType.Reminder,
      mail,
      notifiedActionIds: [],
    });
    await ctx.dataSource.getRepository(User).delete(deleted.id);
    const body = opening("4d4d4d4d4d");

    await post(body).expect(204);

    expect(await trackingFor("4d4d4d4d4d")).toBeNull();
    expect(
      await openings().findOneByOrFail({ openingId: body.openingId }),
    ).toMatchObject({ messageTrackingId: null });
  });

  it("keeps a personal reminder's action after its group is deleted", async () => {
    const { action, memberActionEvent, reminderGroup } =
      await saveReminderGroup("Deleted reminder");
    await saveLegacy({
      cid: "1234512345",
      mail: true,
      mms: false,
      notif: { reminderGroup, memberActionEvent },
    });
    await ctx.dataSource.getRepository(ReminderGroup).delete(reminderGroup.id);

    await post(opening("1234512345")).expect(204);

    expect(await trackingFor("1234512345")).toMatchObject({
      context: { actionId: action.id, actionName: "Legacy action" },
    });
  });

  it("recovers a reminder's email", async () => {
    const { mail } = await saveLegacy({
      cid: "eeeeeeeeee",
      mail: true,
      mms: false,
      notif: true,
    });

    await post(opening("eeeeeeeeee")).expect(204);

    expect(await trackingFor("eeeeeeeeee")).toMatchObject({
      channel: MessageChannel.Email,
      userId: member.id,
    });
    expect(
      await ctx.dataSource
        .getRepository(Mail)
        .findOneByOrFail({ id: mail!.id }),
    ).toMatchObject({ clickedLink: true });
  });

  const saveRecognition = async (params: {
    user: User;
    cid: string;
    mail: Mail | null;
    mms: Mms | null;
  }) => {
    const { user, cid, mail, mms } = params;
    const action = await saveAction();
    const snapshot = await ctx.dataSource.getRepository(FormSnapshot).save({
      schema: { blocks: [] },
      hash: `link-openings-legacy-recognition-${cid}`,
    });
    const update = await ctx.dataSource.getRepository(ActionUpdate).save({
      action,
      title: "Update",
      date: new Date(),
      shortNotifString: "Update",
      notifyType: ActionUpdateNotifyType.ActionCohort,
      notificationMode: ActionUpdateNotificationMode.Legacy,
      schemaSnapshotId: snapshot.id,
    });
    await ctx.dataSource.getRepository(ActionUpdateExposure).save({
      actionUpdateId: update.id,
      userId: user.id,
      cid,
      mail,
      mms,
    });
    return { action, update };
  };

  it("recovers the recipient of a recognition", async () => {
    const { mail, mms } = await saveLegacy({
      cid: "abababab01",
      mail: true,
      mms: true,
      notif: false,
    });
    const { action, update } = await saveRecognition({
      user: member,
      cid: "abababab01",
      mail,
      mms,
    });

    await post(opening("abababab01")).expect(204);

    expect(await trackingFor("abababab01")).toMatchObject({
      channel: MessageChannel.Unknown,
      legacy: true,
      userId: member.id,
      source: MessageSource.ActionUpdate,
      actionEventNotifId: null,
      context: { actionId: action.id, actionUpdateId: update.id },
    });
  });

  it("recovers the recipient of a recognition whose text landed after its send timed out", async () => {
    const { mms } = await saveLegacy({
      cid: "abababab03",
      mail: false,
      mms: true,
      notif: false,
    });
    const { update } = await saveRecognition({
      user: member,
      cid: "abababab03",
      mail: null,
      mms: null,
    });

    await post(opening("abababab03")).expect(204);

    expect(await trackingFor("abababab03")).toMatchObject({
      channel: MessageChannel.Sms,
      userId: member.id,
      source: MessageSource.ActionUpdate,
      context: { actionUpdateId: update.id },
    });
    expect(
      await ctx.dataSource.getRepository(Mms).findOneByOrFail({ id: mms!.id }),
    ).toMatchObject({ clickedLink: true });
  });

  it("attributes an ID a reminder and another recipient's recognition shared to neither", async () => {
    const other = await saveMember("recognition-collision@example.org");
    const { mail } = await saveLegacy({
      cid: "abababab02",
      mail: true,
      mms: false,
      notif: true,
    });
    const { mms } = await saveLegacy({
      cid: "abababab02",
      mail: false,
      mms: true,
      notif: false,
    });
    await saveRecognition({ user: other, cid: "abababab02", mail: null, mms });

    await post(opening("abababab02")).expect(204);

    expect(await trackingFor("abababab02")).toBeNull();
    const [reloadedMail, reloadedMms] = await Promise.all([
      ctx.dataSource.getRepository(Mail).findOneByOrFail({ id: mail!.id }),
      ctx.dataSource.getRepository(Mms).findOneByOrFail({ id: mms!.id }),
    ]);
    expect(reloadedMail.clickedLink).toBe(false);
    expect(reloadedMms.clickedLink).toBe(false);
  });

  it("attributes an ID two recipients' reminders shared to neither", async () => {
    const other = await saveMember("collision@example.org");
    const { mail } = await saveLegacy({
      cid: "dddddddddd",
      mail: true,
      mms: false,
      notif: true,
    });
    const { mail: otherMail } = await saveLegacy({
      cid: "dddddddddd",
      mail: true,
      mms: false,
      notif: { user: other },
    });

    await post(opening("dddddddddd")).expect(204);

    expect(await trackingFor("dddddddddd")).toBeNull();
    const flags = await ctx.dataSource
      .getRepository(Mail)
      .findBy({ id: In([mail!.id, otherMail!.id]) });
    expect(flags.map((row) => row.clickedLink)).toEqual([false, false]);
  });

  it("attributes nothing to a forum reply's entry when an email and a text shared its ID", async () => {
    const { mms } = await saveLegacy({
      cid: "9999999998",
      mail: true,
      mms: true,
      notif: false,
    });
    await ctx.dataSource.getRepository(Notification).save({
      user: member,
      category: NotificationCategory.ForumReply,
      message: "Someone replied",
      webAppLocation: "/forum",
      cid: "9999999998",
    });

    await post(opening("9999999998")).expect(204);

    expect(await trackingFor("9999999998")).toBeNull();
    expect(
      await ctx.dataSource.getRepository(Mms).findOneByOrFail({ id: mms!.id }),
    ).toMatchObject({ clickedLink: false });
  });

  it("attributes a forum reply to its in-app entry's recipient, and reads it", async () => {
    await saveLegacy({
      cid: "9999999999",
      mail: true,
      mms: false,
      notif: false,
    });
    const notification = await ctx.dataSource.getRepository(Notification).save({
      user: member,
      category: NotificationCategory.ForumReply,
      message: "Someone replied",
      webAppLocation: "/forum",
      cid: "9999999999",
    });

    await post(opening("9999999999")).expect(204);

    expect(
      await ctx.dataSource
        .getRepository(Notification)
        .findOneByOrFail({ id: notification.id }),
    ).toMatchObject({ readAt: expect.any(Date) });
    expect(await trackingFor("9999999999")).toMatchObject({
      channel: MessageChannel.Email,
      legacy: true,
      userId: member.id,
      source: MessageSource.ForumReply,
      context: { notificationIds: [notification.id] },
    });
  });

  it("marks nothing clicked when messages with no owner shared the ID", async () => {
    const { mail, mms } = await saveLegacy({
      cid: "ffffffffff",
      mail: true,
      mms: true,
      notif: false,
    });

    await post(opening("ffffffffff")).expect(204);

    expect(await trackingFor("ffffffffff")).toBeNull();
    const [reloadedMail, reloadedMms] = await Promise.all([
      ctx.dataSource.getRepository(Mail).findOneByOrFail({ id: mail!.id }),
      ctx.dataSource.getRepository(Mms).findOneByOrFail({ id: mms!.id }),
    ]);
    expect(reloadedMail.clickedLink).toBe(false);
    expect(reloadedMms.clickedLink).toBe(false);
  });

  it("reads no in-app entry another recipient's shares the ID with", async () => {
    const other = await saveMember("shared-entry@example.org");
    await saveLegacy({
      cid: "5555555555",
      mail: true,
      mms: false,
      notif: false,
    });
    const notifications = ctx.dataSource.getRepository(Notification);
    const entries = await notifications.save(
      [member, other].map((user) => ({
        user,
        category: NotificationCategory.ForumReply,
        message: "Someone replied",
        webAppLocation: "/forum",
        cid: "5555555555",
      })),
    );

    await post(opening("5555555555")).expect(204);

    const reloaded = await notifications.findBy({
      id: In(entries.map((entry) => entry.id)),
    });
    expect(reloaded.map((entry) => entry.readAt)).toEqual([null, null]);
  });

  it("attributes nothing when another recipient's message shares a reminder's ID", async () => {
    const { mail } = await saveLegacy({
      cid: "7777777777",
      mail: true,
      mms: false,
      notif: true,
    });
    const strayMail = await ctx.dataSource.getRepository(Mail).save({
      to: "stray@example.org",
      status: EmailStatus.Sent,
      emailType: EmailType.ForumReply,
      sentMessageId: null,
      renderedHtml: null,
      cid: "7777777777",
    });

    await post(opening("7777777777")).expect(204);

    expect(await trackingFor("7777777777")).toBeNull();
    const flags = await ctx.dataSource
      .getRepository(Mail)
      .findBy({ id: In([mail!.id, strayMail.id]) });
    expect(flags.map((row) => row.clickedLink)).toEqual([false, false]);
  });

  it("leaves another recipient's in-app entry unread when it shares a reminder's ID", async () => {
    const other = await saveMember("other-entry@example.org");
    await saveLegacy({
      cid: "8888888888",
      mail: true,
      mms: false,
      notif: true,
    });
    const notification = await ctx.dataSource.getRepository(Notification).save({
      user: other,
      category: NotificationCategory.ForumReply,
      message: "Someone replied",
      webAppLocation: "/forum",
      cid: "8888888888",
    });

    await post(opening("8888888888")).expect(204);

    expect(await trackingFor("8888888888")).toMatchObject({
      userId: member.id,
    });
    expect(
      await ctx.dataSource
        .getRepository(Notification)
        .findOneByOrFail({ id: notification.id }),
    ).toMatchObject({ readAt: null });
  });

  it("attributes a reminder whose text landed after its send timed out", async () => {
    const { mms } = await saveLegacy({
      cid: "2b2b2b2b2b",
      mail: true,
      mms: true,
      notif: { mms: null },
    });

    await post(opening("2b2b2b2b2b")).expect(204);

    expect(await trackingFor("2b2b2b2b2b")).toMatchObject({
      channel: MessageChannel.Unknown,
      userId: member.id,
      source: MessageSource.ActionReminder,
    });
    expect(
      await ctx.dataSource.getRepository(Mms).findOneByOrFail({ id: mms!.id }),
    ).toMatchObject({ clickedLink: true });
  });

  it("reads a missed-suite notice's in-app entry through its shared ID", async () => {
    await saveLegacy({
      cid: "3c3c3c3c3c",
      mail: true,
      mms: false,
      notif: { type: ActionEventNotifType.MissedDeadline },
    });
    const notification = await ctx.dataSource.getRepository(Notification).save({
      user: member,
      category: NotificationCategory.ActionEvent,
      message: "You missed a deadline",
      webAppLocation: "/tasks",
      cid: "3c3c3c3c3c",
    });

    await post(opening("3c3c3c3c3c")).expect(204);

    expect(await trackingFor("3c3c3c3c3c")).toMatchObject({
      source: MessageSource.MissedSuiteNotice,
    });
    expect(
      await ctx.dataSource
        .getRepository(Notification)
        .findOneByOrFail({ id: notification.id }),
    ).toMatchObject({ readAt: expect.any(Date) });
  });
});
