import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifsclaimedby1767898017690 implements MigrationInterface {
    name = 'Notifsclaimedby1767898017690'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "FK_5b1c4d66c7751efbb20de60096a"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "UQ_5b1c4d66c7751efbb20de60096a"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "pushId"`);
        await queryRunner.query(`ALTER TABLE "notification" ADD "pushClaimedBy" character varying`);
        await queryRunner.query(`ALTER TABLE "push" ADD "actionEventNotifId" integer`);
        await queryRunner.query(`ALTER TABLE "push" ADD CONSTRAINT "FK_f2755b9165fbafc978a23940edb" FOREIGN KEY ("actionEventNotifId") REFERENCES "action_event_notif"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "push" DROP CONSTRAINT "FK_f2755b9165fbafc978a23940edb"`);
        await queryRunner.query(`ALTER TABLE "push" DROP COLUMN "actionEventNotifId"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "pushClaimedBy"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "pushId" integer`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "UQ_5b1c4d66c7751efbb20de60096a" UNIQUE ("pushId")`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "FK_5b1c4d66c7751efbb20de60096a" FOREIGN KEY ("pushId") REFERENCES "push"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
