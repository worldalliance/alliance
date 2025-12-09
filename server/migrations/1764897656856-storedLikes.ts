import { MigrationInterface, QueryRunner } from "typeorm";

export class StoredLikes1764897656856 implements MigrationInterface {
    name = 'StoredLikes1764897656856'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" ADD "likesCount" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP COLUMN "likesCount"`);
    }

}
