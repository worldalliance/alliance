import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemberInviteShareUrlAttribution1784151565746 implements MigrationInterface {
  name = 'MemberInviteShareUrlAttribution1784151565746';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "referredByShareUrlId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_3476833c4b18b10f8e7a65a2d6d" FOREIGN KEY ("referredByShareUrlId") REFERENCES "share_url"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_3476833c4b18b10f8e7a65a2d6d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "referredByShareUrlId"`,
    );
  }
}
