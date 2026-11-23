import { MigrationInterface, QueryRunner } from "typeorm";

export class OtpChallengeOwner1795397975192 implements MigrationInterface {
    name = 'OtpChallengeOwner1795397975192'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_53c4019ce842b4852cafa04864"`);
        await queryRunner.query(`ALTER TABLE "otp_challenge" ADD "userId" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_f8a80070719d51cf0f48d54512" ON "otp_challenge" ("purpose", "destination", "userId") `);
        await queryRunner.query(`ALTER TABLE "otp_challenge" ADD CONSTRAINT "FK_3a10423bec297182337de6e9442" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "otp_challenge" DROP CONSTRAINT "FK_3a10423bec297182337de6e9442"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8a80070719d51cf0f48d54512"`);
        await queryRunner.query(`ALTER TABLE "otp_challenge" DROP COLUMN "userId"`);
        await queryRunner.query(`CREATE INDEX "IDX_53c4019ce842b4852cafa04864" ON "otp_challenge" ("destination", "purpose") `);
    }

}
