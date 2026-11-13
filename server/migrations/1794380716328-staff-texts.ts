import { MigrationInterface, QueryRunner } from "typeorm";

export class StaffTexts1794380716328 implements MigrationInterface {
    name = 'StaffTexts1794380716328'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mms" ADD "sentById" integer`);
        await queryRunner.query(`COMMENT ON COLUMN "mms"."sentById" IS 'Staff member who wrote it'`);
        await queryRunner.query(`ALTER TABLE "mms" ADD CONSTRAINT "FK_0f6196717b4378fe6d9a7f82ae5" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mms" DROP CONSTRAINT "FK_0f6196717b4378fe6d9a7f82ae5"`);
        await queryRunner.query(`COMMENT ON COLUMN "mms"."sentById" IS 'Staff member who wrote it'`);
        await queryRunner.query(`ALTER TABLE "mms" DROP COLUMN "sentById"`);
    }

}
