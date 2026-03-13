import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill notification message text for existing activity-like notifications
 * that are not for completion events. Previously all activity likes used
 * "completion of" / "action activity"; we now use "commitment to" / "action commitment"
 * for user_joined and "follow-up to" / "follow-up response" for user_submitted_follow_up_form.
 */
export class ActivityLikeNotifMessageNonCompletion1773432988253
  implements MigrationInterface
{
  name = 'ActivityLikeNotifMessageNonCompletion1773432988253';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_joined: "completion of" -> "commitment to", "action activity" -> "action commitment"
    await queryRunner.query(`
      UPDATE "notification" n
      SET "message" = REPLACE(REPLACE(n."message", 'completion of:', 'commitment to:'), 'action activity', 'action commitment')
      FROM "action_activity" aa
      WHERE n."category" = 'likes'
        AND n."groupingKey" LIKE 'activity_like:%'
        AND aa."id" = CAST(SUBSTRING(n."groupingKey" FROM 15) AS INTEGER)
        AND aa."type" = 'user_joined';
    `);
    // user_submitted_follow_up_form: "completion of" -> "follow-up to", "action activity" -> "follow-up response"
    await queryRunner.query(`
      UPDATE "notification" n
      SET "message" = REPLACE(REPLACE(n."message", 'completion of:', 'follow-up to:'), 'action activity', 'follow-up response')
      FROM "action_activity" aa
      WHERE n."category" = 'likes'
        AND n."groupingKey" LIKE 'activity_like:%'
        AND aa."id" = CAST(SUBSTRING(n."groupingKey" FROM 15) AS INTEGER)
        AND aa."type" = 'user_submitted_follow_up_form';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: "commitment to" -> "completion of", "action commitment" -> "action activity"
    await queryRunner.query(`
      UPDATE "notification" n
      SET "message" = REPLACE(REPLACE(n."message", 'commitment to:', 'completion of:'), 'action commitment', 'action activity')
      FROM "action_activity" aa
      WHERE n."category" = 'likes'
        AND n."groupingKey" LIKE 'activity_like:%'
        AND aa."id" = CAST(SUBSTRING(n."groupingKey" FROM 15) AS INTEGER)
        AND aa."type" = 'user_joined';
    `);
    // Revert: "follow-up to" -> "completion of", "follow-up response" -> "action activity"
    await queryRunner.query(`
      UPDATE "notification" n
      SET "message" = REPLACE(REPLACE(n."message", 'follow-up to:', 'completion of:'), 'follow-up response', 'action activity')
      FROM "action_activity" aa
      WHERE n."category" = 'likes'
        AND n."groupingKey" LIKE 'activity_like:%'
        AND aa."id" = CAST(SUBSTRING(n."groupingKey" FROM 15) AS INTEGER)
        AND aa."type" = 'user_submitted_follow_up_form';
    `);
  }
}
