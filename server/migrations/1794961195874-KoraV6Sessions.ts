import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraV6Sessions1794961195874 implements MigrationInterface {
    name = 'KoraV6Sessions1794961195874'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "kora_session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reviewerId" uuid NOT NULL, "number" integer NOT NULL, "budgetUnits" real NOT NULL, "schemaBatchId" uuid NOT NULL, "export" jsonb, "lastActivityAt" TIMESTAMP WITH TIME ZONE NOT NULL, "closesAt" TIMESTAMP WITH TIME ZONE, "endedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_14a4807f417407781a2f8d83f8d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e34b7b0f3cecaa8fee4e2fe3eb" ON "kora_session" ("reviewerId") `);
        await queryRunner.query(`CREATE TYPE "public"."KoraItemType" AS ENUM('scored', 'practice', 'attention', 'test')`);
        await queryRunner.query(`CREATE TABLE "kora_conversation" ("id" character varying NOT NULL, "batchId" uuid NOT NULL, "position" integer NOT NULL, "riskId" character varying NOT NULL, "itemType" "public"."KoraItemType" NOT NULL, "nTurns" integer NOT NULL, "optIn" boolean NOT NULL, "content" jsonb NOT NULL, "contentHash" character varying NOT NULL, CONSTRAINT "PK_0da15312b03c808a4f8785a90a6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4b8a7cba89c36deb14d6bce71f" ON "kora_conversation" ("riskId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_72ad83a61c0032d2319feb4555" ON "kora_conversation" ("batchId", "position") `);
        await queryRunner.query(`CREATE TABLE "kora_session_conversation" ("sessionId" uuid NOT NULL, "conversationId" character varying NOT NULL, "position" integer NOT NULL, "ratedPosition" integer, "firstTimeOnRisk" boolean NOT NULL, "status" "public"."KoraReviewStatus" NOT NULL DEFAULT 'pending', "attentionPass" boolean, "lastActivityAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_048f95806ec5771a191de20e5e5" PRIMARY KEY ("sessionId", "conversationId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf6d14a7401b1e14b85fedecba" ON "kora_session_conversation" ("conversationId", "status") `);
        // Spec v6 replaces the pair review, so every upload made for it goes, and its tables with it.
        // kora_transcript and kora_assignment cascade from kora_batch; no review had opened.
        await queryRunner.query(`DELETE FROM "kora_batch"`);
        await queryRunner.query(`DROP TABLE "kora_assignment_transcript"`);
        await queryRunner.query(`DROP TABLE "kora_assignment"`);
        await queryRunner.query(`DROP TABLE "kora_transcript"`);
        await queryRunner.query(`ALTER TABLE "kora_batch" DROP COLUMN "transcriptsPerAssignment"`);
        await queryRunner.query(`ALTER TABLE "kora_batch" DROP COLUMN "reviewsPerTranscript"`);
        await queryRunner.query(`ALTER TABLE "kora_batch" ADD "reviewsPerConversation" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" ADD "extendedOptIn" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "kora_session" ADD CONSTRAINT "FK_e34b7b0f3cecaa8fee4e2fe3ebc" FOREIGN KEY ("reviewerId") REFERENCES "kora_reviewer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_session" ADD CONSTRAINT "FK_df0af0bb5006b3ee02e7699cca5" FOREIGN KEY ("schemaBatchId") REFERENCES "kora_batch"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_conversation" ADD CONSTRAINT "FK_59007e55213860830bc145cec34" FOREIGN KEY ("batchId") REFERENCES "kora_batch"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_session_conversation" ADD CONSTRAINT "FK_05eaab66ec94252b2b6e6c2e0ef" FOREIGN KEY ("sessionId") REFERENCES "kora_session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_session_conversation" ADD CONSTRAINT "FK_70849668b1ba1ee53b2b4448591" FOREIGN KEY ("conversationId") REFERENCES "kora_conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_session_conversation" DROP CONSTRAINT "FK_70849668b1ba1ee53b2b4448591"`);
        await queryRunner.query(`ALTER TABLE "kora_session_conversation" DROP CONSTRAINT "FK_05eaab66ec94252b2b6e6c2e0ef"`);
        await queryRunner.query(`ALTER TABLE "kora_conversation" DROP CONSTRAINT "FK_59007e55213860830bc145cec34"`);
        await queryRunner.query(`ALTER TABLE "kora_session" DROP CONSTRAINT "FK_df0af0bb5006b3ee02e7699cca5"`);
        await queryRunner.query(`ALTER TABLE "kora_session" DROP CONSTRAINT "FK_e34b7b0f3cecaa8fee4e2fe3ebc"`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" DROP COLUMN "extendedOptIn"`);
        await queryRunner.query(`ALTER TABLE "kora_batch" DROP COLUMN "reviewsPerConversation"`);
        await queryRunner.query(`CREATE TABLE "kora_transcript" ("id" character varying NOT NULL, "batchId" uuid NOT NULL, "position" integer NOT NULL, "category" character varying NOT NULL, "content" jsonb NOT NULL, "contentHash" character varying NOT NULL, CONSTRAINT "PK_ccb3daf0142041244b118a43e65" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "kora_assignment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reviewerId" uuid NOT NULL, "extra" boolean NOT NULL, "schemaBatchId" uuid NOT NULL, "export" jsonb, "lastActivityAt" TIMESTAMP WITH TIME ZONE NOT NULL, "closesAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_cf8832408becf84e5bddd61d5fc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "kora_assignment_transcript" ("assignmentId" uuid NOT NULL, "transcriptId" character varying NOT NULL, "position" integer NOT NULL, "status" "public"."KoraReviewStatus" NOT NULL DEFAULT 'pending', "lastActivityAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d1cb454b6b47ac64f7de79c3d47" PRIMARY KEY ("assignmentId", "transcriptId"))`);
        await queryRunner.query(`ALTER TABLE "kora_batch" ADD "reviewsPerTranscript" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "kora_batch" ADD "transcriptsPerAssignment" integer NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf6d14a7401b1e14b85fedecba"`);
        await queryRunner.query(`DROP TABLE "kora_session_conversation"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_72ad83a61c0032d2319feb4555"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4b8a7cba89c36deb14d6bce71f"`);
        await queryRunner.query(`DROP TABLE "kora_conversation"`);
        await queryRunner.query(`DROP TYPE "public"."KoraItemType"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e34b7b0f3cecaa8fee4e2fe3eb"`);
        await queryRunner.query(`DROP TABLE "kora_session"`);
    }

}
