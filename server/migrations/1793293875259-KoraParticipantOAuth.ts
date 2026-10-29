import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraParticipantOAuth1793293875259 implements MigrationInterface {
    name = 'KoraParticipantOAuth1793293875259'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "kora_participant_oauth_identity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "participantId" uuid NOT NULL, "provider" "public"."OAuthProvider" NOT NULL, "subject" character varying NOT NULL, "email" citext NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bdc2890d614edd4e57d028eb9c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f788d8dfded70b337baed2c63e" ON "kora_participant_oauth_identity" ("participantId", "provider") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b3db3c2029db6605e5d20a9077" ON "kora_participant_oauth_identity" ("provider", "subject") `);
        await queryRunner.query(`ALTER TABLE "kora_participant_signup" ADD "provider" "public"."OAuthProvider"`);
        await queryRunner.query(`ALTER TABLE "kora_participant_signup" ADD "subject" character varying`);
        await queryRunner.query(`ALTER TABLE "kora_participant_signup" ADD CONSTRAINT "CHK_kora_participant_signup_identity" CHECK (("provider" IS NULL) = ("subject" IS NULL))`);
        await queryRunner.query(`ALTER TABLE "kora_participant_oauth_identity" ADD CONSTRAINT "FK_2dbffaa5e10527b2db82bf0da49" FOREIGN KEY ("participantId") REFERENCES "kora_participant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_participant_oauth_identity" DROP CONSTRAINT "FK_2dbffaa5e10527b2db82bf0da49"`);
        await queryRunner.query(`ALTER TABLE "kora_participant_signup" DROP CONSTRAINT "CHK_kora_participant_signup_identity"`);
        await queryRunner.query(`ALTER TABLE "kora_participant_signup" DROP COLUMN "subject"`);
        await queryRunner.query(`ALTER TABLE "kora_participant_signup" DROP COLUMN "provider"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3db3c2029db6605e5d20a9077"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f788d8dfded70b337baed2c63e"`);
        await queryRunner.query(`DROP TABLE "kora_participant_oauth_identity"`);
    }

}
