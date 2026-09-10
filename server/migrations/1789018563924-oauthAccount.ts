import { MigrationInterface, QueryRunner } from "typeorm";

export class OauthAccount1789018563924 implements MigrationInterface {
    name = 'OauthAccount1789018563924'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."OAuthProvider" AS ENUM('google', 'apple')`);
        await queryRunner.query(`CREATE TABLE "oauth_account" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "provider" "public"."OAuthProvider" NOT NULL, "subject" character varying NOT NULL, "email" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8b7ff18465972f261dacf3fe935" UNIQUE ("userId", "provider"), CONSTRAINT "UQ_ffe532125ea5d5e03a0bc76da41" UNIQUE ("provider", "subject"), CONSTRAINT "PK_01ec7d2a8273dcaaed3dd10a4fb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "oauth_account" ADD CONSTRAINT "FK_a9124d5956d6244b17bdd67f92b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "oauth_account" DROP CONSTRAINT "FK_a9124d5956d6244b17bdd67f92b"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "password" SET NOT NULL`);
        await queryRunner.query(`DROP TABLE "oauth_account"`);
        await queryRunner.query(`DROP TYPE "public"."OAuthProvider"`);
    }

}
