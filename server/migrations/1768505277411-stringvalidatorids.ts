import { MigrationInterface, QueryRunner } from 'typeorm';

export class Stringvalidatorids1768505277411 implements MigrationInterface {
  name = 'Stringvalidatorids1768505277411';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE "custom_validator"
          ALTER COLUMN "idArgument"
          TYPE character varying
          USING "idArgument"::text
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE "custom_validator"
          ALTER COLUMN "idArgument"
          TYPE integer
          USING "idArgument"::integer
        `);
  }
}
