import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionActivities1750568457263 implements MigrationInterface {
    name = 'ActionActivities1750568457263'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "action_activity" ("id" SERIAL NOT NULL, "type" character varying NOT NULL, "actionId" integer NOT NULL, "userId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "metadata" text, "dollar_amount" integer, CONSTRAINT "PK_c48bfc3bed3be79c9c7a45bcce0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_bf0e513b5cd8b4e937fa0702311"`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD CONSTRAINT "FK_348c2ac5fa8d45c7f31487291e4" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD CONSTRAINT "FK_451c6a1b9e6018fe21061aa8506" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP CONSTRAINT "FK_451c6a1b9e6018fe21061aa8506"`);
        await queryRunner.query(`ALTER TABLE "action_activity" DROP CONSTRAINT "FK_348c2ac5fa8d45c7f31487291e4"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_bf0e513b5cd8b4e937fa0702311" UNIQUE ("referralCode")`);
        await queryRunner.query(`DROP TABLE "action_activity"`);
    }

}
