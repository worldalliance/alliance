import { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicGroups1769553511301 implements MigrationInterface {
  name = 'PublicGroups1769553511301';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community" ADD "public" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "community" ADD "maxCapacity" integer DEFAULT 10`,
    );
    await queryRunner.query(
      `ALTER TABLE "community" ADD CONSTRAINT "CHK_1283e98329417b7470357bc73d" CHECK (("public" = false) OR ("maxCapacity" IS NOT NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community" DROP CONSTRAINT "CHK_1283e98329417b7470357bc73d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "community" DROP COLUMN "maxCapacity"`,
    );
    await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "public"`);
  }
}
