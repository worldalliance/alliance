import { MigrationInterface, QueryRunner } from "typeorm";

export class UserUnsubscribedNumberIndex1795140000000 implements MigrationInterface {
    name = 'UserUnsubscribedNumberIndex1795140000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_e3f56be212886a73b52f0544e8" ON "user" ("phoneNumber") WHERE "phoneNumberUnsubscribed"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_e3f56be212886a73b52f0544e8"`);
    }

}
