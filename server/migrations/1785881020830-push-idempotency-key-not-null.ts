import { MigrationInterface, QueryRunner } from "typeorm";

export class PushIdempotencyKeyNotNull1785881020830 implements MigrationInterface {
    name = 'PushIdempotencyKeyNotNull1785881020830'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f5a7d64ef41260aecf95941796"`);
        // Rows predating the NOT NULL come from the admin test push, which never
        // set a key. Backfill off the primary key so each stays unique under the
        // rebuilt index and can't collide with a real key.
        await queryRunner.query(`UPDATE "push" SET "idempotencyKey" = 'legacy-' || "id" WHERE "idempotencyKey" IS NULL`);
        await queryRunner.query(`ALTER TABLE "push" ALTER COLUMN "idempotencyKey" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b3b2d0922c85dbb07cc4696fb6" ON "push" ("idempotencyKey") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_b3b2d0922c85dbb07cc4696fb6"`);
        await queryRunner.query(`ALTER TABLE "push" ALTER COLUMN "idempotencyKey" DROP NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f5a7d64ef41260aecf95941796" ON "push" ("idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL)`);
    }

}
