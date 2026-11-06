import { MigrationInterface, QueryRunner } from "typeorm";

export class CampaignInvitePageDescription1793924891631 implements MigrationInterface {
    name = 'CampaignInvitePageDescription1793924891631'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaign" ADD "invitePageDescription" character varying(200)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaign" DROP COLUMN "invitePageDescription"`);
    }

}
