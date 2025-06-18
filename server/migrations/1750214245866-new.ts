import { MigrationInterface, QueryRunner } from "typeorm";

export class New1750214245866 implements MigrationInterface {
    name = 'New1750214245866'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "testNewColumn" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "testNewColumn"`);
    }

}
