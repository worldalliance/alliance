import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionReviewerTable1787950897428 implements MigrationInterface {
    name = 'ActionReviewerTable1787950897428'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."action_reviewer_icon_enum" AS ENUM('linkedin')`);
        await queryRunner.query(`CREATE TABLE "action_reviewer" ("id" SERIAL NOT NULL, "actionId" integer NOT NULL, "name" text NOT NULL, "url" text, "icon" "public"."action_reviewer_icon_enum", "position" integer NOT NULL, CONSTRAINT "PK_ea4daaa2cc6c388a6405d0ab140" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0df36d768f583b0b718d1c37ab" ON "action_reviewer" ("actionId") `);
        await queryRunner.query(`ALTER TABLE "action_reviewer" ADD CONSTRAINT "FK_0df36d768f583b0b718d1c37ab3" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // Array order becomes `position`. A row whose jsonb never matched the
        // documented shape fails here rather than being dropped silently.
        await queryRunner.query(`
            INSERT INTO "action_reviewer" ("actionId", "name", "url", "icon", "position")
            SELECT a."id",
                   r.value ->> 'name',
                   r.value ->> 'url',
                   (r.value ->> 'icon')::"public"."action_reviewer_icon_enum",
                   r.ordinality - 1
            FROM "action" a,
                 LATERAL jsonb_array_elements(a."reviewers") WITH ORDINALITY AS r(value, ordinality)
            WHERE jsonb_typeof(a."reviewers") = 'array'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_reviewer" DROP CONSTRAINT "FK_0df36d768f583b0b718d1c37ab3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0df36d768f583b0b718d1c37ab"`);
        await queryRunner.query(`DROP TABLE "action_reviewer"`);
        await queryRunner.query(`DROP TYPE "public"."action_reviewer_icon_enum"`);
    }

}
