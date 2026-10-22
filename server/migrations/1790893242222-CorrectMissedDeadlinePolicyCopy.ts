import { MigrationInterface, QueryRunner } from "typeorm";

const OBSOLETE =
  "If you miss all of your assigned non-optional actions for three weeks in a row, your contract will be suspended automatically.";
const CORRECTED =
  "If you miss any assigned non-optional task for three weeks in a row, your agreement will be suspended automatically.";

/** Rewrites groups whose deadline is still ahead; past groups keep the copy they went out with. */
export class CorrectMissedDeadlinePolicyCopy1790893242222
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.swap(queryRunner, OBSOLETE, CORRECTED);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.swap(queryRunner, CORRECTED, OBSOLETE);
  }

  private async swap(queryRunner: QueryRunner, from: string, to: string) {
    await queryRunner.query(
      `UPDATE reminder_group rg
       SET "textMessage" = replace(rg."textMessage", $1, $2),
           "pushMessage" = replace(rg."pushMessage", $1, $2),
           "emailMessage" = replace(rg."emailMessage", $1, $2)
       FROM action_event deadline
       WHERE deadline.id = rg."deadlineEventId"
         AND deadline.date > now()`,
      [from, to],
    );
  }
}
