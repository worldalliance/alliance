import { MigrationInterface, QueryRunner } from 'typeorm';

export class Noextralinkflag1761244760921 implements MigrationInterface {
  name = 'Noextralinkflag1761244760921';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "includeActionLinkInMessages"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD "includeActionLinkInMessages" boolean NOT NULL`,
    );
  }
}
