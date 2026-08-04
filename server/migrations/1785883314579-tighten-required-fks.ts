import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FK columns whose entity relation is non-optional and whose FK is `ON DELETE
 * CASCADE` — the parent going away takes the child with it, so NULL was never a
 * reachable state, only an unenforced one. TypeORM leaves `@ManyToOne` columns
 * nullable unless told otherwise, which is why these drifted.
 *
 * Each `SET NOT NULL` scans its table and aborts the deploy if a single row
 * disagrees, so confirm every column below is NULL-free in production before
 * shipping this — a local database is too small to prove it.
 */
const COLUMNS: [table: string, column: string][] = [
  ['action_event', 'actionId'],
  ['action_event_notif', 'userId'],
  ['action_update', 'actionId'],
  ['community_invite', 'communityId'],
  ['community_invite', 'invitedUserId'],
  ['contract_event', 'userId'],
  ['friend', 'addresseeId'],
  ['friend', 'requesterId'],
  ['message', 'authorId'],
  ['message', 'conversationId'],
  ['mms_optout', 'userId'],
  ['notification', 'userId'],
  ['participant', 'conversationId'],
  ['participant', 'userId'],
  ['reminder_group', 'memberActionEventId'],
  ['unread_content', 'userId'],
  ['user_device', 'userId'],
];

export class TightenRequiredFks1785883314579 implements MigrationInterface {
  name = 'TightenRequiredFks1785883314579';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP NOT NULL`,
      );
    }
  }
}
