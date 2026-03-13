import { MigrationInterface, QueryRunner } from "typeorm";

export class PushUser1773445061042 implements MigrationInterface {
    name = 'PushUser1773445061042'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "push" ADD "userId" integer`);
        await queryRunner.query(`ALTER TABLE "push" ADD CONSTRAINT "FK_c0ddff7c2766185f9791e0e4dda" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "push" DROP CONSTRAINT "FK_c0ddff7c2766185f9791e0e4dda"`);
        await queryRunner.query(`ALTER TABLE "push" DROP COLUMN "userId"`);
    }

}
