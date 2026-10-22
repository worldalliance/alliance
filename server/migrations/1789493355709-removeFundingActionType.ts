import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveFundingActionType1789493355709 implements MigrationInterface {
    name = 'RemoveFundingActionType1789493355709'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const funding: { id: number }[] = await queryRunner.query(`SELECT "id" FROM "action" WHERE "type" = 'Funding'`);
        if (funding.length > 0) {
            throw new Error(`Funding actions still exist: ${funding.map(({ id }) => id).join(", ")}`);
        }
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "donationAmount"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."action_type_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."action_type_enum" AS ENUM('Funding', 'Activity')`);
        await queryRunner.query(`ALTER TABLE "action" ADD "type" "public"."action_type_enum" NOT NULL DEFAULT 'Activity'`);
        await queryRunner.query(`ALTER TABLE "action" ADD "donationAmount" integer DEFAULT '500'`);
    }

}
