import { MigrationInterface, QueryRunner } from "typeorm";

export class ProjectParticipantAuth1793217323661 implements MigrationInterface {
    name = 'ProjectParticipantAuth1793217323661'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "project_participant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "email" citext, "phoneNumber" character varying, "timeZone" character varying, "contactVerifiedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_project_participant_name_not_blank" CHECK (btrim("name") <> ''), CONSTRAINT "CHK_project_participant_phone_e164" CHECK ("phoneNumber" ~ '^[+][1-9][0-9]{1,14}$'), CONSTRAINT "CHK_project_participant_one_contact" CHECK (("email" IS NULL) <> ("phoneNumber" IS NULL)), CONSTRAINT "PK_149de99a476203f813c3cb43a09" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_98c30a7d285ab1ebaaa528a9ff" ON "project_participant" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dfec63cf438e6ddcd17095769a" ON "project_participant" ("phoneNumber") `);
        await queryRunner.query(`CREATE TABLE "project_participant_signup" ("tokenHash" character varying NOT NULL, "channel" "public"."OtpChannel" NOT NULL, "destination" citext NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_df5c7c89628cac73789cc0614b2" PRIMARY KEY ("tokenHash"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c1edb5c3499d9464db56ad31a8" ON "project_participant_signup" ("expiresAt") `);
        await queryRunner.query(`CREATE TABLE "project_participant_session" ("tokenHash" character varying NOT NULL, "participantId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ba5f9ac4c74494a22cec557d2f6" PRIMARY KEY ("tokenHash"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ccebbd78931744eee151caa467" ON "project_participant_session" ("participantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_44a9f6eb18868ff658c76ffaa5" ON "project_participant_session" ("expiresAt") `);
        await queryRunner.query(`ALTER TABLE "project_participant_session" ADD CONSTRAINT "FK_ccebbd78931744eee151caa4673" FOREIGN KEY ("participantId") REFERENCES "project_participant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_participant_session" DROP CONSTRAINT "FK_ccebbd78931744eee151caa4673"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_44a9f6eb18868ff658c76ffaa5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccebbd78931744eee151caa467"`);
        await queryRunner.query(`DROP TABLE "project_participant_session"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c1edb5c3499d9464db56ad31a8"`);
        await queryRunner.query(`DROP TABLE "project_participant_signup"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dfec63cf438e6ddcd17095769a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98c30a7d285ab1ebaaa528a9ff"`);
        await queryRunner.query(`DROP TABLE "project_participant"`);
    }

}
