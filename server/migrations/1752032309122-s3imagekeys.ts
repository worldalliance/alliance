import { MigrationInterface, QueryRunner } from 'typeorm';

export class S3imagekeys1752032309122 implements MigrationInterface {
  name = 'S3imagekeys1752032309122';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // delete all images
    await queryRunner.query(`DELETE FROM "image"`);
    await queryRunner.query(`ALTER TABLE "image" DROP COLUMN "filename"`);
    await queryRunner.query(
      `ALTER TABLE "image" ADD "key" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "image" ADD "mime" character varying NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "image" ADD "size" integer NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "image" DROP COLUMN "size"`);
    await queryRunner.query(`ALTER TABLE "image" DROP COLUMN "mime"`);
    await queryRunner.query(`ALTER TABLE "image" DROP COLUMN "key"`);
    await queryRunner.query(
      `ALTER TABLE "image" ADD "filename" character varying NOT NULL`,
    );
  }
}
