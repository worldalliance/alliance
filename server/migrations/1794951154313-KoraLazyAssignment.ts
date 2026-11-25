import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraLazyAssignment1794951154313 implements MigrationInterface {
    name = 'KoraLazyAssignment1794951154313'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ADD "lastActivityAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5236f6656c0d02919e939226a5"`);
        await queryRunner.query(`ALTER TYPE "public"."KoraReviewStatus" RENAME TO "KoraReviewStatus_old"`);
        await queryRunner.query(`CREATE TYPE "public"."KoraReviewStatus" AS ENUM('pending', 'done', 'opted_out', 'released')`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ALTER COLUMN "status" TYPE "public"."KoraReviewStatus" USING "status"::"text"::"public"."KoraReviewStatus"`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."KoraReviewStatus_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_5236f6656c0d02919e939226a5" ON "kora_assignment_transcript" ("transcriptId", "status") `);
        // Opened pending pairs keep their assignment's last save as their clock; unopened ones get an expired
        // clock, so the server releases them on the reviewer's next visit and no longer counts them meanwhile.
        await queryRunner.query(`UPDATE "kora_assignment_transcript" at SET "lastActivityAt" = CASE
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a."export"->'results') = 'array'
                    THEN a."export"->'results' ELSE '[]'::jsonb END) r
                WHERE r->>'transcriptId' = at."transcriptId" AND r->>'startedAt' IS NOT NULL
            ) THEN a."lastActivityAt"
            ELSE 'epoch'::timestamptz END
            FROM "kora_assignment" a
            WHERE a."id" = at."assignmentId" AND at."status" = 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_5236f6656c0d02919e939226a5"`);
        await queryRunner.query(`CREATE TYPE "public"."KoraReviewStatus_old" AS ENUM('pending', 'done', 'opted_out')`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ALTER COLUMN "status" TYPE "public"."KoraReviewStatus_old" USING "status"::"text"::"public"."KoraReviewStatus_old"`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."KoraReviewStatus"`);
        await queryRunner.query(`ALTER TYPE "public"."KoraReviewStatus_old" RENAME TO "KoraReviewStatus"`);
        await queryRunner.query(`CREATE INDEX "IDX_5236f6656c0d02919e939226a5" ON "kora_assignment_transcript" ("status", "transcriptId") `);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" DROP COLUMN "lastActivityAt"`);
    }

}
