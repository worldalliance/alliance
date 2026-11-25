import { MigrationInterface, QueryRunner } from "typeorm";

export class PhoneNumberUniqueLive1795465786963 implements MigrationInterface {
    name = 'PhoneNumberUniqueLive1795465786963'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_user_phone_number_live" ON "user" ("phoneNumber") WHERE "deletedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_user_phone_number_live"`);
    }

}
