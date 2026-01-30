import { MigrationInterface, QueryRunner } from "typeorm";

export class OnboardingFlag1769645653830 implements MigrationInterface {
    name = 'OnboardingFlag1769645653830'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "onboarding" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "onboarding"`);
    }

}
