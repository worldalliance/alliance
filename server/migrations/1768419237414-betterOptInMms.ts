import { MigrationInterface, QueryRunner } from "typeorm";

export class BetterOptInMms1768419237414 implements MigrationInterface {
    name = 'BetterOptInMms1768419237414'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN "sentTextOptInMessageAt" TO "optInMmsId"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "optInMmsId"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "optInMmsId" integer`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_a110e7ea3a0882d731c025f508b" UNIQUE ("optInMmsId")`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_a110e7ea3a0882d731c025f508b" FOREIGN KEY ("optInMmsId") REFERENCES "mms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_a110e7ea3a0882d731c025f508b"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_a110e7ea3a0882d731c025f508b"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "optInMmsId"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "optInMmsId" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN "optInMmsId" TO "sentTextOptInMessageAt"`);
    }

}
