import { MigrationInterface, QueryRunner } from "typeorm";

export class RequireActionShortDescription1792158853630 implements MigrationInterface {
    name = 'RequireActionShortDescription1792158853630'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "shortDescription" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "shortDescription" SET DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "shortDescription" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "shortDescription" DROP NOT NULL`);
    }

}
