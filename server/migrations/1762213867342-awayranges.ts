import { MigrationInterface, QueryRunner } from "typeorm";

export class Awayranges1762213867342 implements MigrationInterface {
    name = 'Awayranges1762213867342'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_away_range" DROP CONSTRAINT "FK_user_away_range_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_away_range_userId"`);
        await queryRunner.query(`ALTER TABLE "user_away_range" ADD CONSTRAINT "FK_7e4ed9228611c23a5813be11c8a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_away_range" DROP CONSTRAINT "FK_7e4ed9228611c23a5813be11c8a"`);
        await queryRunner.query(`CREATE INDEX "IDX_user_away_range_userId" ON "user_away_range" ("userId") `);
        await queryRunner.query(`ALTER TABLE "user_away_range" ADD CONSTRAINT "FK_user_away_range_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
