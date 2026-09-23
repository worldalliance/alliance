import { MigrationInterface, QueryRunner } from "typeorm";

export class UnreadNotifsReadBeforeDue1790194531828 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "notification" SET "readAt" = NULL WHERE "readAt" < "sendTime" AND "sendTime" > now()`);
        await queryRunner.query(`UPDATE "unread_content" SET "readAt" = NULL WHERE "readAt" < "sendTime" AND "sendTime" > now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
