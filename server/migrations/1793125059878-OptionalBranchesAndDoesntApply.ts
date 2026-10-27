import { MigrationInterface, QueryRunner } from "typeorm";

export class OptionalBranchesAndDoesntApply1793125059878 implements MigrationInterface {
    name = 'OptionalBranchesAndDoesntApply1793125059878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "optional" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "optionalReason" character varying`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD "doesntApply" boolean`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP COLUMN "doesntApply"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "optionalReason"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "optional"`);
    }

}
