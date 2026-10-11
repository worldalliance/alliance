import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Recounts `usersCompleted` under `findLatestCompletions`. The app recounts an
 * action only when a completion or withdrawal is written to it, so a closed
 * action keeps its old count without this.
 */
export class RecountUsersCompleted1791721478548 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH latest AS (
        SELECT DISTINCT ON ("userId", "actionId") "actionId", type
        FROM action_activity
        WHERE type IN ('user_completed', 'user_wont_complete')
        ORDER BY "userId", "actionId", "createdAt" DESC, id DESC
      )
      UPDATE action SET "usersCompleted" = (
        SELECT count(*) FROM latest
        WHERE latest."actionId" = action.id AND latest.type = 'user_completed'
      )
    `);
  }

  public async down(): Promise<void> {}
}
