import { MigrationInterface, QueryRunner } from "typeorm";

export class Dailystats1764894662670 implements MigrationInterface {
    name = 'Dailystats1764894662670'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "daily_stats_record" ("id" SERIAL NOT NULL, "dayId" character varying NOT NULL, "date" TIMESTAMP NOT NULL, "signedMembers" integer NOT NULL, "suspendedMembers" integer NOT NULL, "actionsCompleted" integer NOT NULL, "invitesCreated" integer NOT NULL, "invitesAccepted" integer NOT NULL, CONSTRAINT "UQ_cbcca62c7bcc14a88b131cc3cce" UNIQUE ("dayId"), CONSTRAINT "PK_c459b27857cad18ca37dfb89cd0" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "daily_stats_record"`);
    }

}
