import { MigrationInterface, QueryRunner } from "typeorm";

export class CampaignOrganization1790718744193 implements MigrationInterface {
    name = 'CampaignOrganization1790718744193'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."campaign_kind_enum" AS ENUM('campaign', 'organization')`);
        await queryRunner.query(`ALTER TABLE "campaign" ADD "kind" "public"."campaign_kind_enum" NOT NULL DEFAULT 'campaign'`);
        await queryRunner.query(`ALTER TABLE "campaign" ADD "communityId" integer`);
        await queryRunner.query(`ALTER TABLE "campaign" ADD CONSTRAINT "UQ_c5b96ecaf553d05508734cf7814" UNIQUE ("communityId")`);
        await queryRunner.query(`ALTER TABLE "campaign" ADD CONSTRAINT "CHK_campaign_community_organization" CHECK ("communityId" IS NULL OR "kind" = 'organization')`);
        await queryRunner.query(`ALTER TABLE "campaign" ADD CONSTRAINT "FK_c5b96ecaf553d05508734cf7814" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaign" DROP CONSTRAINT "FK_c5b96ecaf553d05508734cf7814"`);
        await queryRunner.query(`ALTER TABLE "campaign" DROP CONSTRAINT "CHK_campaign_community_organization"`);
        await queryRunner.query(`ALTER TABLE "campaign" DROP CONSTRAINT "UQ_c5b96ecaf553d05508734cf7814"`);
        await queryRunner.query(`ALTER TABLE "campaign" DROP COLUMN "communityId"`);
        await queryRunner.query(`ALTER TABLE "campaign" DROP COLUMN "kind"`);
        await queryRunner.query(`DROP TYPE "public"."campaign_kind_enum"`);
    }

}
