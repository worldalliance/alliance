import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraAbandonedSignup1794251449977 implements MigrationInterface {
    name = 'KoraAbandonedSignup1794251449977'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "kora_abandoned_signup" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channel" "public"."OtpChannel" NOT NULL, "destination" citext NOT NULL, "provider" "public"."OAuthProvider", "verifiedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_9bfc63b1cc1092376d109a979d8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_15d78e7ba7ba69775c789cd09e" ON "kora_abandoned_signup" ("channel", "destination") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_15d78e7ba7ba69775c789cd09e"`);
        await queryRunner.query(`DROP TABLE "kora_abandoned_signup"`);
    }

}
