import { MigrationInterface, QueryRunner } from "typeorm";

export class SuiteSplitPlacements1795402842779 implements MigrationInterface {
    name = 'SuiteSplitPlacements1795402842779'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "suite_split_placement" ("id" SERIAL NOT NULL, "suiteId" integer NOT NULL, "userId" integer NOT NULL, "groupId" uuid NOT NULL, "pinId" integer NOT NULL, "trace" jsonb NOT NULL, "placedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_suite_split_placement_suiteId_userId" UNIQUE ("suiteId", "userId"), CONSTRAINT "PK_6743cee9cbfba915ddbcbbc672f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_suite_split_placement_userId" ON "suite_split_placement" ("userId") `);
        await queryRunner.query(`ALTER TABLE "suite_split_placement" ADD CONSTRAINT "FK_5866489a489ceefc13da192c802" FOREIGN KEY ("suiteId") REFERENCES "suite_split"("suiteId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suite_split_placement" ADD CONSTRAINT "FK_4b936e5f8d780f9e328cd62a294" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suite_split_placement" ADD CONSTRAINT "FK_3267817c6488d523c822c45a865" FOREIGN KEY ("pinId") REFERENCES "suite_split_pin"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "suite_split_placement" DROP CONSTRAINT "FK_3267817c6488d523c822c45a865"`);
        await queryRunner.query(`ALTER TABLE "suite_split_placement" DROP CONSTRAINT "FK_4b936e5f8d780f9e328cd62a294"`);
        await queryRunner.query(`ALTER TABLE "suite_split_placement" DROP CONSTRAINT "FK_5866489a489ceefc13da192c802"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_suite_split_placement_userId"`);
        await queryRunner.query(`DROP TABLE "suite_split_placement"`);
    }

}
