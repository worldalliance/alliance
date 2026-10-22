import { MigrationInterface, QueryRunner } from "typeorm";

export class InviteMessageTemplate1788910302609 implements MigrationInterface {
    name = 'InviteMessageTemplate1788910302609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "invite_message_template" ("id" character varying(32) NOT NULL, "template" text NOT NULL, CONSTRAINT "PK_a9ec743830b9e3bde4e571bd0fe" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "invite_message_template"`);
    }

}
