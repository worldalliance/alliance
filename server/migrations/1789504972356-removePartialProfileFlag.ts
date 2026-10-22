import { MigrationInterface, QueryRunner } from "typeorm";

export class RemovePartialProfileFlag1789504972356 implements MigrationInterface {
    name = 'RemovePartialProfileFlag1789504972356'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const partial: { id: number }[] = await queryRunner.query(`SELECT "id" FROM "user" WHERE "isNotSignedUpPartialProfile"`);
        if (partial.length > 0) {
            throw new Error(`Partial profiles still exist: ${partial.map(({ id }) => id).join(", ")}`);
        }
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isNotSignedUpPartialProfile"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "isNotSignedUpPartialProfile" boolean NOT NULL DEFAULT false`);
    }

}
