import { MigrationInterface, QueryRunner } from "typeorm";

export class LinkOpenings1791319793555 implements MigrationInterface {
    name = 'LinkOpenings1791319793555'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."link_opening_platform_enum" AS ENUM('web', 'mobile')`);
        await queryRunner.query(`CREATE TABLE "link_opening" ("id" SERIAL NOT NULL, "openingId" uuid NOT NULL, "messageTrackingId" integer NOT NULL, "destination" character varying NOT NULL, "platform" "public"."link_opening_platform_enum" NOT NULL, "observedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3b8cbab0f36c29204e180eaa8c0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_00ad076b3f5a1de0f86711ae8b" ON "link_opening" ("openingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8dd96e70896c4545657cd1c58" ON "link_opening" ("messageTrackingId") `);
        await queryRunner.query(`ALTER TABLE "link_opening" ADD CONSTRAINT "FK_d8dd96e70896c4545657cd1c58c" FOREIGN KEY ("messageTrackingId") REFERENCES "message_tracking"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "link_opening" DROP CONSTRAINT "FK_d8dd96e70896c4545657cd1c58c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8dd96e70896c4545657cd1c58"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_00ad076b3f5a1de0f86711ae8b"`);
        await queryRunner.query(`DROP TABLE "link_opening"`);
        await queryRunner.query(`DROP TYPE "public"."link_opening_platform_enum"`);
    }

}
