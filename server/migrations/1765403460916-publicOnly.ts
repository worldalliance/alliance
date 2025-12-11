import { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicOnly1765403460916 implements MigrationInterface {
  name = 'PublicOnly1765403460916';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action" ADD "publicOnly" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "publicOnly"`);
  }
}
