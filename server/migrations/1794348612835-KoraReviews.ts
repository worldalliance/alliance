import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraReviews1794348612835 implements MigrationInterface {
    name = 'KoraReviews1794348612835'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "kora_reviewer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "participantId" uuid, "userId" integer, "profileAnsweredAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_065e97c19434f5de0a850b826b" CHECK (num_nonnulls("participantId", "userId") = 1), CONSTRAINT "PK_94c62f8d788826efe3e9ed139f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c1822e8ad06d1db1a50a841b16" ON "kora_reviewer" ("participantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e32a2c8a7a9c68d8b02f98fb88" ON "kora_reviewer" ("userId") `);
        await queryRunner.query(`CREATE TABLE "kora_assignment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reviewerId" uuid NOT NULL, "extra" boolean NOT NULL, "schemaBatchId" uuid NOT NULL, "export" jsonb, "lastActivityAt" TIMESTAMP WITH TIME ZONE NOT NULL, "completedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_cf8832408becf84e5bddd61d5fc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_77a9f10bfba222bc47309b4bba" ON "kora_assignment" ("reviewerId") `);
        await queryRunner.query(`CREATE TYPE "public"."KoraReviewStatus" AS ENUM('pending', 'done', 'opted_out')`);
        await queryRunner.query(`CREATE TABLE "kora_assignment_transcript" ("assignmentId" uuid NOT NULL, "transcriptId" character varying NOT NULL, "position" integer NOT NULL, "status" "public"."KoraReviewStatus" NOT NULL DEFAULT 'pending', CONSTRAINT "PK_d1cb454b6b47ac64f7de79c3d47" PRIMARY KEY ("assignmentId", "transcriptId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5236f6656c0d02919e939226a5" ON "kora_assignment_transcript" ("transcriptId", "status") `);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" ADD CONSTRAINT "FK_c1822e8ad06d1db1a50a841b164" FOREIGN KEY ("participantId") REFERENCES "kora_participant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" ADD CONSTRAINT "FK_e32a2c8a7a9c68d8b02f98fb881" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" ADD CONSTRAINT "FK_77a9f10bfba222bc47309b4bba8" FOREIGN KEY ("reviewerId") REFERENCES "kora_reviewer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" ADD CONSTRAINT "FK_cd3616425b848c61ffd4eff0556" FOREIGN KEY ("schemaBatchId") REFERENCES "kora_batch"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ADD CONSTRAINT "FK_f62996124e2cfb960a14e08ce74" FOREIGN KEY ("assignmentId") REFERENCES "kora_assignment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" ADD CONSTRAINT "FK_fee9463d12aca1272034fe699b3" FOREIGN KEY ("transcriptId") REFERENCES "kora_transcript"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" DROP CONSTRAINT "FK_fee9463d12aca1272034fe699b3"`);
        await queryRunner.query(`ALTER TABLE "kora_assignment_transcript" DROP CONSTRAINT "FK_f62996124e2cfb960a14e08ce74"`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" DROP CONSTRAINT "FK_cd3616425b848c61ffd4eff0556"`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" DROP CONSTRAINT "FK_77a9f10bfba222bc47309b4bba8"`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" DROP CONSTRAINT "FK_e32a2c8a7a9c68d8b02f98fb881"`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" DROP CONSTRAINT "FK_c1822e8ad06d1db1a50a841b164"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5236f6656c0d02919e939226a5"`);
        await queryRunner.query(`DROP TABLE "kora_assignment_transcript"`);
        await queryRunner.query(`DROP TYPE "public"."KoraReviewStatus"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_77a9f10bfba222bc47309b4bba"`);
        await queryRunner.query(`DROP TABLE "kora_assignment"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e32a2c8a7a9c68d8b02f98fb88"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c1822e8ad06d1db1a50a841b16"`);
        await queryRunner.query(`DROP TABLE "kora_reviewer"`);
    }

}
