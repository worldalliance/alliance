import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistBrowser1790743113867 implements MigrationInterface {
    name = 'WaitlistBrowser1790743113867'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "waitlist_browser" ("tokenHash" character varying NOT NULL, "entryId" integer NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d7d71a65d8f61dfabe0ea4880d0" PRIMARY KEY ("tokenHash"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fd51b3cddbeedb9ba3d194fe1e" ON "waitlist_browser" ("entryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f51b049b7485e6ab670abecee2" ON "waitlist_browser" ("expiresAt") `);
        await queryRunner.query(`ALTER TABLE "waitlist_browser" ADD CONSTRAINT "FK_fd51b3cddbeedb9ba3d194fe1e1" FOREIGN KEY ("entryId") REFERENCES "waitlist_entry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_browser" DROP CONSTRAINT "FK_fd51b3cddbeedb9ba3d194fe1e1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f51b049b7485e6ab670abecee2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd51b3cddbeedb9ba3d194fe1e"`);
        await queryRunner.query(`DROP TABLE "waitlist_browser"`);
    }

}
