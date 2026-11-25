import { MigrationInterface, QueryRunner } from "typeorm";

export class MmsThreadLaunchCutoff1794961449435 implements MigrationInterface {
    name = 'MmsThreadLaunchCutoff1794961449435'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mms_thread" ADD "launchCutoffId" integer`);
        await queryRunner.query(`COMMENT ON COLUMN "mms_thread"."launchCutoffId" IS 'Needs reply skips inbound texts up to this one: the newest when per-number threads launched, set only if no live member held the number'`);
        await queryRunner.query(`ALTER TABLE "mms_thread" ADD CONSTRAINT "FK_568b53bc51cf6988b67b04c74fc" FOREIGN KEY ("launchCutoffId") REFERENCES "mms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        // Old texts from numbers no live member holds stay out of Needs reply.
        await queryRunner.query(`
            UPDATE "mms_thread" thread
            SET "launchCutoffId" = latest.id
            FROM (
                SELECT DISTINCT ON ("memberPhoneNumber") "memberPhoneNumber", id
                FROM "mms"
                WHERE direction = 'inbound'
                ORDER BY "memberPhoneNumber", "createdAt" DESC, id DESC
            ) latest
            WHERE latest."memberPhoneNumber" = thread."phoneNumber"
              AND NOT EXISTS (
                SELECT 1 FROM "user" member
                WHERE member."phoneNumber" = thread."phoneNumber"
                  AND member."deletedAt" IS NULL
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mms_thread" DROP CONSTRAINT "FK_568b53bc51cf6988b67b04c74fc"`);
        await queryRunner.query(`ALTER TABLE "mms_thread" DROP COLUMN "launchCutoffId"`);
    }

}
