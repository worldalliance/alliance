import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveOngoingActionType1789490228708 implements MigrationInterface {
    name = 'RemoveOngoingActionType1789490228708'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const ongoing: { id: number }[] = await queryRunner.query(`SELECT "id" FROM "action" WHERE "type" = 'Ongoing'`);
        if (ongoing.length > 0) {
            throw new Error(`Ongoing actions still exist: ${ongoing.map(({ id }) => id).join(", ")}`);
        }
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "taskContents"`);
        await queryRunner.query(`ALTER TYPE "public"."action_type_enum" RENAME TO "action_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."action_type_enum" AS ENUM('Funding', 'Activity')`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "type" TYPE "public"."action_type_enum" USING "type"::"text"::"public"."action_type_enum"`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "type" SET DEFAULT 'Activity'`);
        await queryRunner.query(`DROP TYPE "public"."action_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."action_type_enum_old" AS ENUM('Funding', 'Activity', 'Ongoing')`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "type" TYPE "public"."action_type_enum_old" USING "type"::"text"::"public"."action_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "type" SET DEFAULT 'Activity'`);
        await queryRunner.query(`DROP TYPE "public"."action_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."action_type_enum_old" RENAME TO "action_type_enum"`);
        await queryRunner.query(`ALTER TABLE "action" ADD "taskContents" character varying`);
    }

}
