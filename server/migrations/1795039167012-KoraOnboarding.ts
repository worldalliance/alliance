import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraOnboarding1795039167012 implements MigrationInterface {
    name = 'KoraOnboarding1795039167012'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_reviewer" DROP COLUMN "profileAnsweredAt"`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" ADD "demographics" jsonb`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" ADD "consentAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" ADD "onboardedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_reviewer" DROP COLUMN "onboardedAt"`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" DROP COLUMN "consentAt"`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" DROP COLUMN "demographics"`);
        await queryRunner.query(`ALTER TABLE "kora_reviewer" ADD "profileAnsweredAt" TIMESTAMP WITH TIME ZONE`);
    }

}
