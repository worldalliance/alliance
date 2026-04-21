import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGuestSession1776810392237 implements MigrationInterface {
    name = 'AddGuestSession1776810392237'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "guest" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_57689d19445de01737dbc458857" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "form_response" ADD "guestId" uuid`);
        await queryRunner.query(`ALTER TABLE "form_response" ADD CONSTRAINT "CHK_05a629385967d647bfb9fb9587" CHECK (NOT ("userId" IS NOT NULL AND "guestId" IS NOT NULL))`);
        await queryRunner.query(`ALTER TABLE "form_response" ADD CONSTRAINT "FK_e81faa0f99527696f9637679939" FOREIGN KEY ("guestId") REFERENCES "guest"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response" DROP CONSTRAINT "FK_e81faa0f99527696f9637679939"`);
        await queryRunner.query(`ALTER TABLE "form_response" DROP CONSTRAINT "CHK_05a629385967d647bfb9fb9587"`);
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "guestId"`);
        await queryRunner.query(`DROP TABLE "guest"`);
    }

}
