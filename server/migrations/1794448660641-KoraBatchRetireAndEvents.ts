import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraBatchRetireAndEvents1794448660641 implements MigrationInterface {
    name = 'KoraBatchRetireAndEvents1794448660641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."KoraBatchEventKind" AS ENUM('upload', 'retire', 'reactivate', 'delete', 'assignment_completed')`);
        await queryRunner.query(`CREATE TABLE "kora_batch_event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" "public"."KoraBatchEventKind" NOT NULL, "batchId" uuid, "batchUploadedAt" TIMESTAMP WITH TIME ZONE, "transcriptCount" integer, "ratingCount" integer, "assignmentCount" integer, "assignmentId" uuid, "reviewerId" uuid, "adminId" integer, "adminName" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d89490a21262a0a2f5e141c3c72" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ccec3d20020bbe72045dc5001a" ON "kora_batch_event" ("createdAt") `);
        await queryRunner.query(`ALTER TABLE "kora_batch" ADD "retiredAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "kora_batch_event" ADD CONSTRAINT "FK_4e2fdca67c2bf77f88f5c6c6322" FOREIGN KEY ("adminId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_batch_event" DROP CONSTRAINT "FK_4e2fdca67c2bf77f88f5c6c6322"`);
        await queryRunner.query(`ALTER TABLE "kora_batch" DROP COLUMN "retiredAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccec3d20020bbe72045dc5001a"`);
        await queryRunner.query(`DROP TABLE "kora_batch_event"`);
        await queryRunner.query(`DROP TYPE "public"."KoraBatchEventKind"`);
    }

}
