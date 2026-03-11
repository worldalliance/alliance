import { MigrationInterface, QueryRunner } from "typeorm";

export class LiveActivityIndex1773261111949 implements MigrationInterface {
    name = 'LiveActivityIndex1773261111949'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "live_activity_registration" DROP CONSTRAINT "FK_live_activity_registration_action"`);
        await queryRunner.query(`ALTER TABLE "live_activity_registration" DROP CONSTRAINT "FK_live_activity_registration_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_live_activity_registration_user_action"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ae668abe22b44336fe57c35e86" ON "live_activity_registration" ("userId", "actionId") `);
        await queryRunner.query(`ALTER TABLE "live_activity_registration" ADD CONSTRAINT "FK_c052910fc3552b44cead5f3051a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "live_activity_registration" ADD CONSTRAINT "FK_8c0d74e380efaeb42bd4c48d5ab" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "live_activity_registration" DROP CONSTRAINT "FK_8c0d74e380efaeb42bd4c48d5ab"`);
        await queryRunner.query(`ALTER TABLE "live_activity_registration" DROP CONSTRAINT "FK_c052910fc3552b44cead5f3051a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae668abe22b44336fe57c35e86"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_live_activity_registration_user_action" ON "live_activity_registration" ("actionId", "userId") `);
        await queryRunner.query(`ALTER TABLE "live_activity_registration" ADD CONSTRAINT "FK_live_activity_registration_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "live_activity_registration" ADD CONSTRAINT "FK_live_activity_registration_action" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
