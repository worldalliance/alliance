import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraBatches1794347248300 implements MigrationInterface {
    name = 'KoraBatches1794347248300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "kora_batch" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transcriptsPerAssignment" integer NOT NULL, "reviewsPerTranscript" integer NOT NULL, "exportSchema" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_514601ea2bd33cc636e22093f97" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "kora_transcript" ("id" character varying NOT NULL, "batchId" uuid NOT NULL, "position" integer NOT NULL, "category" character varying NOT NULL, "content" jsonb NOT NULL, "contentHash" character varying NOT NULL, CONSTRAINT "PK_ccb3daf0142041244b118a43e65" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_aa36b43f4abe526ac87c4fb124" ON "kora_transcript" ("batchId", "position") `);
        await queryRunner.query(`ALTER TABLE "kora_transcript" ADD CONSTRAINT "FK_c50399c53aedf1356bbb83d2634" FOREIGN KEY ("batchId") REFERENCES "kora_batch"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_transcript" DROP CONSTRAINT "FK_c50399c53aedf1356bbb83d2634"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa36b43f4abe526ac87c4fb124"`);
        await queryRunner.query(`DROP TABLE "kora_transcript"`);
        await queryRunner.query(`DROP TABLE "kora_batch"`);
    }

}
