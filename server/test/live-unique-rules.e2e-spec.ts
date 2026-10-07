import type { ColumnMetadata } from "typeorm/metadata/ColumnMetadata";
import { createTestApp, TestContext } from "./e2e-test-utils";

/** Unique rules on soft-deleted tables that also hold against deleted rows:
 * keys on a parent id that is never reused, values minted fresh for each row,
 * and rows read with deleted ones on purpose. */
const UNIQUE_ACROSS_DELETED = [
  "ActionActivity.editableContent",
  "ActionActivity.taskFormResponse",
  "ActionCohortDecision.actionId,userId",
  "ActionEventNotif.idempotency_key",
  "ActionEventNotif.mail",
  "ActionEventNotif.mms",
  "ActionEventNotif.notification",
  "ActionStatsRecord.actionId",
  "ActionUpdateExposure.actionUpdateId,userId",
  "ActionUpdateExposure.mail",
  "ActionUpdateExposure.mms",
  "ActionUpdateExposure.unreadContentId",
  "AmbassadorProgramMember.user",
  "Campaign.code",
  "Campaign.communityId",
  "Comment.editableContent",
  "ContractEvent.user,autoSuspendKey",
  "DailyStatsRecord.dayId",
  "ExperimentAssignment.userId,experiment",
  "FormSnapshot.hash",
  "ForumDigestLog.user,digestDate",
  "Friend.acceptedNotif",
  "Friend.sentNotif",
  "LinkOpening.openingId",
  "MessageTracking.trackingId",
  "Post.editableContent",
  "Push.idempotencyKey",
  "User.optInMms",
  "User.referredByInvite",
  "User.welcomeMail",
  "WaitlistEmailBatch.requestId",
  "WaitlistEmailRecipient.batchId,entryId",
  "WaitlistEntry.code",
  "WaitlistEntry.email",
  "WaitlistEntry.phoneNumber",
  "WaitlistEntry.unsubscribeToken",
  "WaitlistLink.code",
];

describe("Live-row unique rules (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("scopes every other unique rule on a soft-deleted table to live rows", () => {
    const live = '"deletedAt" IS NULL';
    const unscoped = ctx.dataSource.entityMetadatas
      .filter((metadata) => metadata.deleteDateColumn)
      .flatMap((metadata) => {
        const rule = (columns: ColumnMetadata[]) =>
          `${metadata.name}.${columns.map((column) => column.propertyName).join(",")}`;
        return [
          ...metadata.uniques.map((unique) => rule(unique.columns)),
          ...metadata.indices
            .filter((index) => index.isUnique && !index.where?.includes(live))
            .map((index) => rule(index.columns)),
          ...metadata.exclusions
            .filter((exclusion) => !exclusion.expression?.includes(live))
            .map((exclusion) => `${metadata.name} ${exclusion.expression}`),
        ];
      })
      .sort();

    expect(unscoped).toEqual(UNIQUE_ACROSS_DELETED);
  });
});
