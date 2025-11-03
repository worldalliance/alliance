import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAwayRange1730650000000 implements MigrationInterface {
    name = 'AddUserAwayRange1730650000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "user_away_range" (
                "id" SERIAL NOT NULL,
                "userId" integer NOT NULL,
                "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "note" text,
                CONSTRAINT "PK_user_away_range" PRIMARY KEY ("id"),
                CONSTRAINT "FK_user_away_range_userId" FOREIGN KEY ("userId")
                    REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_user_away_range_userId" ON "user_away_range" ("userId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_user_away_range_userId"`);
        await queryRunner.query(`DROP TABLE "user_away_range"`);
    }

}
