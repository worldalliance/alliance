import { milliseconds } from "date-fns";
import { ActionUpdateRecognitionService } from "src/actions/action-update-recognition.service";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
} from "src/actions/entities/action-update.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { ContractService } from "src/contract/contract.service";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import request from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Action update visibility (e2e)", () => {
  let ctx: TestContext;
  let testAction: Action;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    testAction = await ctx.dataSource.getRepository(Action).save({
      name: "Visibility Action",
      category: [],
      body: "Body",
      visibilityMode: VisibilityMode.Public,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Members act",
      description: "Member phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - milliseconds({ hours: 1 })),
      action: testAction,
    });
    await ctx.app.get(ContractService).signContract({
      userId: ctx.testUserId,
      signedName: "Test Name",
      viaTaskForm: false,
      contractId: ctx.defaultContractId,
    });
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const displaySchema = (text: string) => ({
    blocks: [{ type: "display", kind: "header", id: "b1", text }],
  });

  const createUpdate = async (title: string, date = new Date()) => {
    const created = await request(ctx.app.getHttpServer())
      .post(`/actions/createUpdate/${testAction.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        title,
        shortNotifString: "something happened",
        date: date.toISOString(),
        notifyType: "none",
        notificationMode: "normal",
      })
      .expect(201);
    return created.body as {
      id: number;
      visibleAt: string | null;
      schemaSnapshotId: number;
      associatedEventId: number | null;
    };
  };

  const writeContent = (id: number, snapshotId: number) =>
    request(ctx.app.getHttpServer())
      .patch(`/actions/updateUpdate/${id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        schema: displaySchema("The body"),
        expectedSchemaSnapshotId: snapshotId,
      })
      .expect(200);

  const memberUpdateIds = async () => {
    const response = await request(ctx.app.getHttpServer())
      .get("/actions/updates")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    return (response.body as { id: number }[]).map((update) => update.id);
  };

  const updateIdsOnActionPage = async (token: string, path: string) => {
    const response = await request(ctx.app.getHttpServer())
      .get(`/actions/${path}/${testAction.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    return (response.body.updates as { id: number }[]).map(
      (update) => update.id,
    );
  };

  it("keeps an update with no body off the member-facing reads", async () => {
    const update = await createUpdate("Still being written");

    expect(update.visibleAt).toBeNull();
    expect(update.associatedEventId).toBeNull();
    expect(await memberUpdateIds()).not.toContain(update.id);
    expect(await updateIdsOnActionPage(ctx.accessToken, "slug")).not.toContain(
      update.id,
    );
  });

  it("still shows the draft to admins, who have to be able to finish it", async () => {
    const update = await createUpdate("Draft visible to admin");

    expect(
      await updateIdsOnActionPage(ctx.adminAccessToken, "adminslug"),
    ).toContain(update.id);
  });

  it("publishes the update when its body is first written", async () => {
    const update = await createUpdate("Ready to publish");
    const written = await writeContent(update.id, update.schemaSnapshotId);

    expect(written.body.visibleAt).not.toBeNull();
    expect(await memberUpdateIds()).toContain(update.id);
    expect(await updateIdsOnActionPage(ctx.accessToken, "slug")).toContain(
      update.id,
    );
  });

  it("keeps the original publish time when the body is edited again", async () => {
    const update = await createUpdate("Edited twice");
    const first = await writeContent(update.id, update.schemaSnapshotId);

    const second = await request(ctx.app.getHttpServer())
      .patch(`/actions/updateUpdate/${update.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        schema: displaySchema("A revised body"),
        expectedSchemaSnapshotId: first.body.schemaSnapshotId,
      })
      .expect(200);

    expect(second.body.visibleAt).toBe(first.body.visibleAt);
  });

  describe("unpublishing until the displayed date", () => {
    const setDate = (id: number, date: Date) =>
      request(ctx.app.getHttpServer())
        .patch(`/actions/updateUpdate/${id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ date: date.toISOString() })
        .expect(200);

    const unpublish = (id: number) =>
      request(ctx.app.getHttpServer())
        .post(`/actions/updates/${id}/unpublish`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    const publishNow = (id: number) =>
      request(ctx.app.getHttpServer())
        .post(`/actions/updates/${id}/publish-now`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    const futureDate = () => new Date(Date.now() + milliseconds({ hours: 1 }));

    const publishedWithFutureDate = async (title: string) => {
      const update = await createUpdate(title);
      await writeContent(update.id, update.schemaSnapshotId);
      const dated = await setDate(update.id, futureDate());
      return dated.body as { id: number; date: string; visibleAt: string };
    };

    it("schedules a future-dated update for its displayed date on its first body save", async () => {
      const date = futureDate();
      const update = await createUpdate("Written ahead", date);

      const written = await writeContent(update.id, update.schemaSnapshotId);

      expect(written.body.visibleAt).toBe(date.toISOString());
      expect(await memberUpdateIds()).not.toContain(update.id);
      await publishNow(update.id).expect(200);
      expect(await memberUpdateIds()).toContain(update.id);
    });

    it("schedules for a date set in the same save as the first body", async () => {
      const update = await createUpdate("Dated while written");
      const date = futureDate();

      const written = await request(ctx.app.getHttpServer())
        .patch(`/actions/updateUpdate/${update.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          date: date.toISOString(),
          schema: displaySchema("The body"),
          expectedSchemaSnapshotId: update.schemaSnapshotId,
        })
        .expect(200);

      expect(written.body.visibleAt).toBe(date.toISOString());
    });

    it("hides the update from members until its displayed date", async () => {
      const update = await publishedWithFutureDate("Published too early");
      expect(await memberUpdateIds()).toContain(update.id);

      const unpublished = await unpublish(update.id).expect(200);

      expect(unpublished.body.visibleAt).toBe(update.date);
      expect(await memberUpdateIds()).not.toContain(update.id);
      expect(
        await updateIdsOnActionPage(ctx.accessToken, "slug"),
      ).not.toContain(update.id);
    });

    it("still shows the scheduled update to admins", async () => {
      const update = await publishedWithFutureDate("Scheduled but editable");
      await unpublish(update.id).expect(200);

      expect(
        await updateIdsOnActionPage(ctx.adminAccessToken, "adminslug"),
      ).toContain(update.id);
    });

    it("rejects unpublishing when the displayed date has passed", async () => {
      const update = await createUpdate("Already due");
      await writeContent(update.id, update.schemaSnapshotId);

      await unpublish(update.id).expect(400);
      expect(await memberUpdateIds()).toContain(update.id);
    });

    it("rejects unpublishing an update that was never published", async () => {
      const update = await createUpdate("Never published");
      await setDate(update.id, futureDate());

      await unpublish(update.id).expect(400);
    });

    it("republishes a scheduled update on request", async () => {
      const update = await publishedWithFutureDate("Scheduled by mistake");
      await unpublish(update.id).expect(200);

      const republished = await publishNow(update.id).expect(200);

      expect(republished.body.visibleAt).not.toBe(update.date);
      expect(await memberUpdateIds()).toContain(update.id);
    });

    it("rejects republishing an update that is already visible", async () => {
      const update = await publishedWithFutureDate("Already visible");

      await publishNow(update.id).expect(400);
    });

    it("keeps the scheduled date when the body is edited again", async () => {
      const update = await publishedWithFutureDate("Edited while scheduled");
      const unpublished = await unpublish(update.id).expect(200);

      const rewritten = await request(ctx.app.getHttpServer())
        .patch(`/actions/updateUpdate/${update.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          schema: displaySchema("A revised body"),
          expectedSchemaSnapshotId: unpublished.body.schemaSnapshotId,
        })
        .expect(200);

      expect(rewritten.body.visibleAt).toBe(update.date);
    });

    it("moves a scheduled update's publish time with its date", async () => {
      const update = await createUpdate("Re-dated", futureDate());
      await writeContent(update.id, update.schemaSnapshotId);

      const later = new Date(Date.now() + milliseconds({ hours: 2 }));
      expect((await setDate(update.id, later)).body.visibleAt).toBe(
        later.toISOString(),
      );

      const past = new Date(Date.now() - milliseconds({ hours: 1 }));
      const moved = await setDate(update.id, past);
      expect(new Date(moved.body.visibleAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
      expect(await memberUpdateIds()).toContain(update.id);
    });

    const notifiedAhead = async (mode: ActionUpdateNotificationMode) => {
      const created = await request(ctx.app.getHttpServer())
        .post(`/actions/createUpdate/${testAction.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: "Notified ahead",
          shortNotifString: "something happened",
          date: futureDate().toISOString(),
          notifyType: "all_members",
        })
        .expect(201);
      const id: number = created.body.id;
      await ctx.dataSource
        .getRepository(ActionUpdate)
        .update(id, { notificationMode: mode });
      await writeContent(id, created.body.schemaSnapshotId);
      await request(ctx.app.getHttpServer())
        .post(`/actions/updates/${id}/notify`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      return id;
    };

    const sendTimesOf = async (id: number) =>
      (
        await ctx.dataSource.getRepository(UnreadContent).findBy({
          contentType: UnreadContentType.ActionUpdate,
          contentId: id,
        })
      ).map((entry) => entry.sendTime.getTime());

    it("moves the queued notifications with the date", async () => {
      const id = await notifiedAhead(ActionUpdateNotificationMode.Legacy);
      expect((await sendTimesOf(id)).length).toBeGreaterThan(0);

      const later = new Date(Date.now() + milliseconds({ hours: 2 }));
      await setDate(id, later);
      expect(new Set(await sendTimesOf(id))).toEqual(
        new Set([later.getTime()]),
      );

      await setDate(id, new Date(Date.now() - milliseconds({ hours: 1 })));
      for (const sendTime of await sendTimesOf(id)) {
        expect(sendTime).toBeLessThanOrEqual(Date.now());
      }
    });

    it("sends a recognition update once its date moves into the past", async () => {
      const id = await notifiedAhead(ActionUpdateNotificationMode.Normal);
      expect(await sendTimesOf(id)).toEqual([]);

      await setDate(id, new Date(Date.now() - milliseconds({ hours: 1 })));
      await ctx.app.get(ActionUpdateRecognitionService).prepareDue(new Date());

      expect((await sendTimesOf(id)).length).toBeGreaterThan(0);
    });
  });
});
