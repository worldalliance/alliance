import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCustomExpressionValidators1794339298588 implements MigrationInterface {
    name = 'RemoveCustomExpressionValidators1794339298588'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "custom_validator" WHERE "type" = 'CustomExpression'`);
    }

    // The deleted expressions are not restored.
    public async down(): Promise<void> {}

}
