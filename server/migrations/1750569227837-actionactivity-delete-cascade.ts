import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionactivityDeleteCascade1750569227837 implements MigrationInterface {
    name = 'ActionactivityDeleteCascade1750569227837'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP CONSTRAINT "FK_348c2ac5fa8d45c7f31487291e4"`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD CONSTRAINT "FK_348c2ac5fa8d45c7f31487291e4" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP CONSTRAINT "FK_348c2ac5fa8d45c7f31487291e4"`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD CONSTRAINT "FK_348c2ac5fa8d45c7f31487291e4" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
