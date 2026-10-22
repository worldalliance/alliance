import { MigrationInterface, QueryRunner } from "typeorm";

export class FriendNotSelf1789762695920 implements MigrationInterface {
    name = 'FriendNotSelf1789762695920'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "CHK_c2a5fa35f1708bc44359947e53" CHECK ("requesterId" <> "addresseeId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "CHK_c2a5fa35f1708bc44359947e53"`);
    }

}
