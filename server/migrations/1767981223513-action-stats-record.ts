import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionStatsRecord1767981223513 implements MigrationInterface {
    name = 'ActionStatsRecord1767981223513'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "action_stats_record" ("id" SERIAL NOT NULL, "actionId" integer NOT NULL, "actionName" character varying NOT NULL, "usersCompleted" integer NOT NULL, "usersJoined" integer NOT NULL, "completionRate" double precision NOT NULL, "lastCalculatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "actionCompletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_039342acfb38b737a707ebf8ecb" UNIQUE ("actionId"), CONSTRAINT "PK_73963760a90135214e0a60387f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "visibilityMode" SET DEFAULT 'public'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "visibilityMode" SET DEFAULT 'all_members'`);
        await queryRunner.query(`DROP TABLE "action_stats_record"`);
    }

}
