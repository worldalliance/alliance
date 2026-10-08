import { MigrationInterface, QueryRunner } from "typeorm";

export class OptionalWaitlistSignupFields1791481267826 implements MigrationInterface {
    name = 'OptionalWaitlistSignupFields1791481267826'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ALTER COLUMN "committedAt" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ALTER COLUMN "committedAt" SET NOT NULL`);
    }

}
