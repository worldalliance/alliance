import { AnalyticsEvent } from "@alliance/common/analytics";
import { LinkOpeningPlatform } from "@alliance/common/linkOpening";
import { randomUUID } from "crypto";
import { milliseconds } from "date-fns";
import { LinkOpening } from "src/link-tracking/link-opening.entity";
import { LinkTrackingModule } from "src/link-tracking/link-tracking.module";
import {
  MessageChannel,
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import type { TrackedMessage } from "src/link-tracking/message-tracking.service";
import { Mail } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { Mms } from "src/mms/mms.entity";
import { MmsService } from "src/mms/mms.service";
import {
  ActionEventNotif,
  ActionEventNotifType,
} from "src/notifs/entities/action-event-notif.entity";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { PosthogService } from "src/posthog/posthog.service";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { WaitlistEntry } from "src/waitlist/entities/waitlist-entry.entity";
import supertest from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Link openings (e2e)", () => {
  let ctx: TestContext;
  let mmsService: MmsService;
  let mailService: MailService;
  let member: User;

  const openings = () => ctx.dataSource.getRepository(LinkOpening);
  const trackingFor = (trackingId: string) =>
    ctx.dataSource.getRepository(MessageTracking).findOneBy({ trackingId });

  const post = (body: Record<string, unknown>) =>
    supertest(ctx.app.getHttpServer()).post("/link-openings").send(body);

  const opening = (trackingId: string, overrides = {}) => ({
    openingId: randomUUID(),
    trackingId,
    destination: "/tasks",
    platform: LinkOpeningPlatform.Web,
    observedAt: new Date().toISOString(),
    ...overrides,
  });

  const reminder = (userId: number): TrackedMessage => ({
    owner: { userId },
    source: MessageSource.ActionReminder,
    context: { reminderGroupId: 1, reminderGroupName: "First reminder" },
    actionEventNotifId: null,
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

  const saveEntry = (name: string) =>
    ctx.dataSource.getRepository(WaitlistEntry).save({
      name,
      email: `${name.toLowerCase()}@example.org`,
      code: `${name.toLowerCase()}-code`,
      reason: "To help",
      committedAt: new Date(),
    });

  const sendWaitlistEmail = (
    entry: Pick<WaitlistEntry, "id"> & { email: string },
    context = {},
  ) =>
    mailService.sendWaitlistStaffEmail({
      recipient: entry.email,
      content: { subject: "Hi", bodyHtml: "<p>Hi</p>", unsubscribeUrl: "" },
      tracking: {
        owner: { waitlistEntryId: entry.id },
        source: MessageSource.WaitlistCampaign,
        context,
        actionEventNotifId: null,
      },
    });

  const previousAppUrl = process.env.APP_URL;

  beforeAll(async () => {
    process.env.APP_URL = "https://app.example.org";
    ctx = await createTestApp([LinkTrackingModule]);
    mmsService = ctx.app.get(MmsService);
    mailService = ctx.app.get(MailService);
    member = await saveMember("member@example.org");
  });

  afterAll(async () => {
    process.env.APP_URL = previousAppUrl;
    await ctx.app.close();
  });

  it("gives each channel its own ID and credits an opening only to its own", async () => {
    const mms = await mmsService.sendMms({
      to: "+15555550123",
      body: "Tasks: https://app.example.org/tasks",
      mediaUrls: [],
      tracking: reminder(member.id),
    });
    const mail = await mailService.sendActionEventNotificationEmail({
      subject: "Tasks",
      message: "https://app.example.org/tasks",
      recipient: member.email,
      tracking: reminder(member.id),
    });
    expect(mms?.cid).toBeTruthy();
    expect(mail.cid).toBeTruthy();
    expect(mms?.cid).not.toBe(mail.cid);
    expect(mms?.body).toBe(
      `Tasks: https://app.example.org/tasks?cid=${mms?.cid}`,
    );

    await post(opening(mms!.cid!)).expect(204);

    const tracking = await trackingFor(mms!.cid!);
    expect(tracking).toMatchObject({
      channel: MessageChannel.Sms,
      userId: member.id,
      legacy: false,
    });
    expect(await openings().countBy({ messageTrackingId: tracking!.id })).toBe(
      1,
    );
    const reloaded = await ctx.dataSource
      .getRepository(Mms)
      .findOneByOrFail({ id: mms!.id });
    expect(reloaded.clickedLink).toBe(true);
    const reloadedMail = await ctx.dataSource
      .getRepository(Mail)
      .findOneByOrFail({ id: mail.id });
    expect(reloadedMail.clickedLink).toBe(false);
  });

  it("stores a separate opening once, however often it is retried", async () => {
    const mms = await mmsService.sendMms({
      to: "+15555550123",
      body: "https://app.example.org/tasks",
      mediaUrls: [],
      tracking: reminder(member.id),
    });
    const first = opening(mms!.cid!);
    const capture = jest.spyOn(ctx.app.get(PosthogService), "capture");

    await Promise.all([post(first).expect(204), post(first).expect(204)]);
    await post(first).expect(204);
    await post(opening(mms!.cid!, { destination: "/actions/3" })).expect(204);

    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledWith({
      event: AnalyticsEvent.NotifLinkClick,
      distinctId: String(member.id),
      properties: expect.objectContaining({
        cid: mms!.cid,
        platform: "mms",
        channel: MessageChannel.Sms,
        openingId: first.openingId,
        destination: "/tasks",
        clientPlatform: LinkOpeningPlatform.Web,
      }),
    });
    capture.mockRestore();

    const tracking = await trackingFor(mms!.cid!);
    const rows = await openings().find({
      where: { messageTrackingId: tracking!.id },
      order: { id: "ASC" },
    });
    expect(rows.map((row) => row.destination)).toEqual([
      "/tasks",
      "/actions/3",
    ]);
  });

  it("stores its own normalization of a destination", async () => {
    const mms = await mmsService.sendMms({
      to: "+15555550123",
      body: "https://app.example.org/tasks",
      mediaUrls: [],
      tracking: reminder(member.id),
    });

    await post(
      opening(mms!.cid!, { destination: "/tasks?ref=secret&tab=done" }),
    ).expect(204);

    const tracking = await trackingFor(mms!.cid!);
    expect(
      await openings().findOneByOrFail({ messageTrackingId: tracking!.id }),
    ).toMatchObject({ destination: "/tasks?tab=done" });
  });

  it.each([
    ["an unknown platform", { platform: "desktop" }],
    ["an absolute destination", { destination: "https://evil.example/tasks" }],
    ["a malformed opening ID", { openingId: "not-a-uuid" }],
    ["an unparseable observation", { observedAt: "2026-W40-2" }],
    [
      "an observation past the retry deadline",
      {
        observedAt: new Date(
          Date.now() - milliseconds({ hours: 26 }),
        ).toISOString(),
      },
    ],
    [
      "an observation in the future",
      {
        observedAt: new Date(
          Date.now() + milliseconds({ hours: 2 }),
        ).toISOString(),
      },
    ],
  ])("rejects %s without storing it", async (_, overrides) => {
    const mms = await mmsService.sendMms({
      to: "+15555550123",
      body: "https://app.example.org/tasks",
      mediaUrls: [],
      tracking: reminder(member.id),
    });

    await post(opening(mms!.cid!, overrides)).expect(400);

    const tracking = await trackingFor(mms!.cid!);
    expect(await openings().countBy({ messageTrackingId: tracking!.id })).toBe(
      0,
    );
  });

  it("credits an email's opening to its own Mail row", async () => {
    const mail = await mailService.sendActionEventNotificationEmail({
      subject: "Tasks",
      message: "https://app.example.org/tasks",
      recipient: member.email,
      tracking: reminder(member.id),
    });

    await post(opening(mail.cid!)).expect(204);

    expect(
      await ctx.dataSource.getRepository(Mail).findOneByOrFail({ id: mail.id }),
    ).toMatchObject({ clickedLink: true });
  });

  it("rejects an unknown tracking ID", async () => {
    await post(opening("unknownTrackingId1")).expect(404);
  });

  it("marks the reminder's in-app notification read", async () => {
    const notification = await ctx.dataSource.getRepository(Notification).save({
      user: member,
      category: NotificationCategory.ActionEvent,
      message: "Your tasks are waiting",
      webAppLocation: "/tasks",
    });
    const notif = await ctx.dataSource.getRepository(ActionEventNotif).save({
      user: member,
      type: ActionEventNotifType.Reminder,
      notification,
    });
    const mms = await mmsService.sendMms({
      to: "+15555550123",
      body: "https://app.example.org/tasks",
      mediaUrls: [],
      tracking: { ...reminder(member.id), actionEventNotifId: notif.id },
    });

    await post(opening(mms!.cid!)).expect(204);
    const { readAt } = await ctx.dataSource
      .getRepository(Notification)
      .findOneByOrFail({ id: notification.id });
    await post(opening(mms!.cid!)).expect(204);

    expect(readAt).not.toBeNull();
    expect(
      await ctx.dataSource
        .getRepository(Notification)
        .findOneByOrFail({ id: notification.id }),
    ).toMatchObject({ readAt });
  });

  it("attributes a waitlist email to an entry with no account", async () => {
    const entry = await saveEntry("Entrant");
    const mail = await sendWaitlistEmail(entry, {
      waitlistEmailBatchId: 4,
      waitlistEmailRecipientId: 9,
    });

    const capture = jest.spyOn(ctx.app.get(PosthogService), "capture");

    await post(opening(mail.cid!, { destination: "/signup" })).expect(204);

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: `waitlist_entry_${entry.id}`,
        properties: expect.objectContaining({ $process_person_profile: false }),
      }),
    );
    capture.mockRestore();
    const tracking = await trackingFor(mail.cid!);
    expect(tracking).toMatchObject({
      waitlistEntryId: entry.id,
      userId: null,
      context: { waitlistEmailBatchId: 4, waitlistEmailRecipientId: 9 },
    });
    expect(await openings().countBy({ messageTrackingId: tracking!.id })).toBe(
      1,
    );
  });

  it("deletes a member's openings with them, and refuses later ones", async () => {
    const leaving = await saveMember("leaving@example.org");
    const mms = await mmsService.sendMms({
      to: "+15555550124",
      body: "https://app.example.org/tasks",
      mediaUrls: [],
      tracking: reminder(leaving.id),
    });
    await post(opening(mms!.cid!)).expect(204);
    const tracking = await trackingFor(mms!.cid!);

    await ctx.dataSource.getRepository(User).delete(leaving.id);

    expect(await trackingFor(mms!.cid!)).toBeNull();
    expect(await openings().countBy({ messageTrackingId: tracking!.id })).toBe(
      0,
    );
    await post(opening(mms!.cid!)).expect(404);
  });

  const saveConvert = async (name: string) => {
    const entry = await saveEntry(name);
    const invite = await ctx.dataSource.getRepository(OnetimeInvite).save({
      invitee: name,
      code: `${name.toLowerCase()}-invite`,
      status: OnetimeInviteStatus.LINK_USED,
      invitingUser: null,
      waitlistEntryId: entry.id,
    });
    const users = ctx.dataSource.getRepository(User);
    const member = await users.save(
      users.create({
        email: `${name.toLowerCase()}-member@example.org`,
        password: "pass",
        name: `${name} Example`,
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: invite,
      }),
    );
    return { entry, member };
  };

  it("deletes a converted waitlist entry's openings with the member's account", async () => {
    const { entry, member: convert } = await saveConvert("Convert");
    const mail = await sendWaitlistEmail(entry);
    const converted = opening(mail.cid!, { destination: "/signup" });
    await post(converted).expect(204);
    const unclaimed = await saveEntry("Unclaimed");
    const unclaimedMail = await sendWaitlistEmail(unclaimed);
    const { entry: bystander } = await saveConvert("Bystander");
    const bystanderMail = await sendWaitlistEmail(bystander);

    await ctx.app.get(UserService).deleteUserAdmin({
      userId: convert.id,
      adminId: ctx.adminUserId,
      reason: "Asked to be removed",
      confirmationEmail: convert.email,
    });

    expect(await trackingFor(mail.cid!)).toBeNull();
    expect(await openings().countBy({ openingId: converted.openingId })).toBe(
      0,
    );
    expect(await trackingFor(unclaimedMail.cid!)).not.toBeNull();
    expect(await trackingFor(bystanderMail.cid!)).not.toBeNull();
    await post(opening(mail.cid!)).expect(404);
  });
});
