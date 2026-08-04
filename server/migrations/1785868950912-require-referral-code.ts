import { MigrationInterface, QueryRunner } from "typeorm";

export class RequireReferralCode1785868950912 implements MigrationInterface {
    name = 'RequireReferralCode1785868950912'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 0 nulls locally and @BeforeInsert has always populated this, so this
        // should be a no-op — but a SET NOT NULL that finds one drifted row
        // fails the deploy, and minting a code is what the entity would do.
        await queryRunner.query(
            `UPDATE "user" SET "referralCode" = substr(md5(random()::text || id::text), 1, 13) WHERE "referralCode" IS NULL`,
        );
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "referralCode" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "referralCode" DROP NOT NULL`);
    }

}
