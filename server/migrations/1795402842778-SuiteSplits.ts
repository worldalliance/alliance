import { MigrationInterface, QueryRunner } from "typeorm";

export class SuiteSplits1795402842778 implements MigrationInterface {
    name = 'SuiteSplits1795402842778'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "suite_split" ("suiteId" integer NOT NULL, "createdById" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "launchFailedAt" TIMESTAMP WITH TIME ZONE, "launchFailure" text, CONSTRAINT "PK_15a31b78d0f8f72c10726bf9e9c" PRIMARY KEY ("suiteId"))`);
        await queryRunner.query(`CREATE TABLE "suite_split_version" ("id" SERIAL NOT NULL, "suiteId" integer NOT NULL, "groups" jsonb NOT NULL, "savedById" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_12df340fa1146f982248230ab91" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1703a3f677e3f223d4cb96ab45" ON "suite_split_version" ("suiteId") `);
        await queryRunner.query(`CREATE TABLE "suite_split_pin" ("id" SERIAL NOT NULL, "suiteId" integer NOT NULL, "splitVersionId" integer NOT NULL, "formulaVersionIds" integer array NOT NULL, "listVersionIds" integer array NOT NULL, "pinnedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b2bd160c4490b484f7f5944a2ae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b04b0bd267e726022206b7dcdc" ON "suite_split_pin" ("suiteId") `);
        await queryRunner.query(`ALTER TABLE "suite_split" ADD CONSTRAINT "FK_15a31b78d0f8f72c10726bf9e9c" FOREIGN KEY ("suiteId") REFERENCES "action_suite"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suite_split" ADD CONSTRAINT "FK_29c5ff6f6704b9a394974e20b42" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suite_split_version" ADD CONSTRAINT "FK_1703a3f677e3f223d4cb96ab457" FOREIGN KEY ("suiteId") REFERENCES "suite_split"("suiteId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suite_split_version" ADD CONSTRAINT "FK_89bc5a757d1053b3d65b4bba1de" FOREIGN KEY ("savedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suite_split_pin" ADD CONSTRAINT "FK_b04b0bd267e726022206b7dcdc0" FOREIGN KEY ("suiteId") REFERENCES "suite_split"("suiteId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suite_split_pin" ADD CONSTRAINT "FK_5cdcff4785526a3c91c59fa47d5" FOREIGN KEY ("splitVersionId") REFERENCES "suite_split_version"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "suite_split_pin" DROP CONSTRAINT "FK_5cdcff4785526a3c91c59fa47d5"`);
        await queryRunner.query(`ALTER TABLE "suite_split_pin" DROP CONSTRAINT "FK_b04b0bd267e726022206b7dcdc0"`);
        await queryRunner.query(`ALTER TABLE "suite_split_version" DROP CONSTRAINT "FK_89bc5a757d1053b3d65b4bba1de"`);
        await queryRunner.query(`ALTER TABLE "suite_split_version" DROP CONSTRAINT "FK_1703a3f677e3f223d4cb96ab457"`);
        await queryRunner.query(`ALTER TABLE "suite_split" DROP CONSTRAINT "FK_29c5ff6f6704b9a394974e20b42"`);
        await queryRunner.query(`ALTER TABLE "suite_split" DROP CONSTRAINT "FK_15a31b78d0f8f72c10726bf9e9c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b04b0bd267e726022206b7dcdc"`);
        await queryRunner.query(`DROP TABLE "suite_split_pin"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1703a3f677e3f223d4cb96ab45"`);
        await queryRunner.query(`DROP TABLE "suite_split_version"`);
        await queryRunner.query(`DROP TABLE "suite_split"`);
    }

}
