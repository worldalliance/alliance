import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionShareLink1765411429408 implements MigrationInterface {
  name = 'ActionShareLink1765411429408';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "action_share_url" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "data" jsonb NOT NULL, "userId" integer, "actionId" integer, CONSTRAINT "PK_a9453b847c9391e923ef24333ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_share_url" ADD CONSTRAINT "FK_26313b4e81fe098c368a84cc07c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_share_url" ADD CONSTRAINT "FK_cdd9f4178c5ace26b273f684aee" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_share_url" DROP CONSTRAINT "FK_cdd9f4178c5ace26b273f684aee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_share_url" DROP CONSTRAINT "FK_26313b4e81fe098c368a84cc07c"`,
    );
    await queryRunner.query(`DROP TABLE "action_share_url"`);
  }
}
