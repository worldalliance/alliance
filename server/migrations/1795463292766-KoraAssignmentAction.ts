import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraAssignmentAction1795463292766 implements MigrationInterface {
    name = 'KoraAssignmentAction1795463292766'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_assignment" ADD "actionId" integer`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" ADD "activeSeconds" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" ADD "activeReportedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5180cf0c8dc1191a65b9c502c9" ON "kora_assignment" ("reviewerId", "actionId") WHERE "actionId" IS NOT NULL AND "deletedAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" ADD CONSTRAINT "FK_f47fe8409762815644244eccb0d" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_assignment" DROP CONSTRAINT "FK_f47fe8409762815644244eccb0d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5180cf0c8dc1191a65b9c502c9"`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" DROP COLUMN "activeReportedAt"`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" DROP COLUMN "activeSeconds"`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" DROP COLUMN "actionId"`);
    }

}
