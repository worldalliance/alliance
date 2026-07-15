import { MigrationInterface, QueryRunner } from "typeorm";

export class ReminderTimingAnchorAndNotifiedFilter1784077837422 implements MigrationInterface {
    name = 'ReminderTimingAnchorAndNotifiedFilter1784077837422'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "excludePreviouslyNotified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "timingAnchorEventId" integer`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "notifiedActionIds" integer array`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "memberActionEventId" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_186ea0fad355e0bd61b46ded92" ON "action_event_notif" ("memberActionEventId") `);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD CONSTRAINT "FK_3da5e7fa12244a53ab13cd8ed1c" FOREIGN KEY ("timingAnchorEventId") REFERENCES "action_event"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "FK_186ea0fad355e0bd61b46ded92e" FOREIGN KEY ("memberActionEventId") REFERENCES "action_event"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        // Backfill from the reminder group where it still exists; rows whose
        // group was already deleted stay NULL (they were unattributable before
        // this column existed too). Group-leads nudges stay NULL on purpose:
        // they notify a leader about *other* users' tasks, so they must not
        // count as "this user was notified about this event".
        // "notifiedActionIds" is backfilled with the group's task scope (the
        // suite's actions for suite-count groups, else the member event's own
        // action): which tasks each old message actually enumerated wasn't
        // recorded, and leaving NULL would read as "covered every task" —
        // permanently suppressing catch-ups for users who were notified about
        // tasks a and b pre-deploy and gain task c later. The scope is a
        // superset of what a suite-count message could have enumerated, so
        // catch-ups never repeat those; for non-suite groups it errs the other
        // way (their global task list isn't reconstructible), accepting a
        // possible repeat mention over silently never catching users up.
        await queryRunner.query(`
            UPDATE "action_event_notif" n
            SET "memberActionEventId" = rg."memberActionEventId",
                "notifiedActionIds" = CASE
                  WHEN rg."useSuiteTaskCount" AND rg."actionSuiteId" IS NOT NULL THEN
                    COALESCE(
                      (SELECT array_agg(a.id) FROM "action" a WHERE a."suiteId" = rg."actionSuiteId"),
                      ARRAY[ev."actionId"]
                    )
                  ELSE ARRAY[ev."actionId"]
                END
            FROM "reminder_group" rg
            JOIN "action_event" ev ON ev.id = rg."memberActionEventId"
            WHERE n."reminderGroupId" = rg.id
              AND rg."cohortType" != 'group_leads_with_uncompleted'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "FK_186ea0fad355e0bd61b46ded92e"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP CONSTRAINT "FK_3da5e7fa12244a53ab13cd8ed1c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_186ea0fad355e0bd61b46ded92"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "memberActionEventId"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "notifiedActionIds"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "timingAnchorEventId"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "excludePreviouslyNotified"`);
    }

}
