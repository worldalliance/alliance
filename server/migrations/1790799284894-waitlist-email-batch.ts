import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistEmailBatch1790799284894 implements MigrationInterface {
    name = 'WaitlistEmailBatch1790799284894'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "waitlist_email_batch" ("id" SERIAL NOT NULL, "requestId" uuid NOT NULL, "subject" character varying NOT NULL, "body" text NOT NULL, "mobilize" boolean NOT NULL, "includeClaimed" boolean NOT NULL, "staffUserId" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_666e956cbcc3418bb24448429b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8e80570aa896cae2de75e3320b" ON "waitlist_email_batch" ("requestId") `);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_email_recipient_status_enum" AS ENUM('pending', 'sending', 'sent', 'failed', 'uncertain', 'skipped')`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_email_recipient_skipreason_enum" AS ENUM('unsubscribed', 'invite_claimed')`);
        await queryRunner.query(`CREATE TABLE "waitlist_email_recipient" ("id" SERIAL NOT NULL, "batchId" integer NOT NULL, "entryId" integer NOT NULL, "status" "public"."waitlist_email_recipient_status_enum" NOT NULL DEFAULT 'pending', "skipReason" "public"."waitlist_email_recipient_skipreason_enum", "inviteId" integer, "renderedSubject" text, "renderedHtml" text, "error" text, "attemptedAt" TIMESTAMP WITH TIME ZONE, "acceptedAt" TIMESTAMP WITH TIME ZONE, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6e1a22d66878ae3542e00f3cafd" UNIQUE ("batchId", "entryId"), CONSTRAINT "CHK_waitlist_email_recipient_skip_reason" CHECK (("status" = 'skipped') = ("skipReason" IS NOT NULL)), CONSTRAINT "PK_b89eb89e70e51005cbfbbb2dfa3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f85555a2cef9ae728c0a3e75d9" ON "waitlist_email_recipient" ("entryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_549831cd5ae188aed62a455ecd" ON "waitlist_email_recipient" ("status") `);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_entry_action_kind_enum" RENAME TO "waitlist_entry_action_kind_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_entry_action_kind_enum" AS ENUM('manual_mobilize', 'undo_mobilize', 'email_mobilize')`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" ALTER COLUMN "kind" TYPE "public"."waitlist_entry_action_kind_enum" USING "kind"::"text"::"public"."waitlist_entry_action_kind_enum"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_entry_action_kind_enum_old"`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_batch" ADD CONSTRAINT "FK_e12df65854826d809bc9c046d27" FOREIGN KEY ("staffUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" ADD CONSTRAINT "FK_a38d84b16ed6a6cf460e840ebc7" FOREIGN KEY ("batchId") REFERENCES "waitlist_email_batch"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" ADD CONSTRAINT "FK_f85555a2cef9ae728c0a3e75d98" FOREIGN KEY ("entryId") REFERENCES "waitlist_entry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" ADD CONSTRAINT "FK_02bbdd977ceb9efe2e45508246b" FOREIGN KEY ("inviteId") REFERENCES "onetime_invite"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" DROP CONSTRAINT "FK_02bbdd977ceb9efe2e45508246b"`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" DROP CONSTRAINT "FK_f85555a2cef9ae728c0a3e75d98"`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" DROP CONSTRAINT "FK_a38d84b16ed6a6cf460e840ebc7"`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_batch" DROP CONSTRAINT "FK_e12df65854826d809bc9c046d27"`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_entry_action_kind_enum_old" AS ENUM('manual_mobilize', 'undo_mobilize')`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" ALTER COLUMN "kind" TYPE "public"."waitlist_entry_action_kind_enum_old" USING "kind"::"text"::"public"."waitlist_entry_action_kind_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_entry_action_kind_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_entry_action_kind_enum_old" RENAME TO "waitlist_entry_action_kind_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_549831cd5ae188aed62a455ecd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f85555a2cef9ae728c0a3e75d9"`);
        await queryRunner.query(`DROP TABLE "waitlist_email_recipient"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_email_recipient_skipreason_enum"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_email_recipient_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e80570aa896cae2de75e3320b"`);
        await queryRunner.query(`DROP TABLE "waitlist_email_batch"`);
    }

}
