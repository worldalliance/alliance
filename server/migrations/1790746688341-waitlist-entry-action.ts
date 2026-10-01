import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistEntryAction1790746688341 implements MigrationInterface {
    name = 'WaitlistEntryAction1790746688341'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."waitlist_entry_action_kind_enum" AS ENUM('manual_mobilize', 'undo_mobilize')`);
        await queryRunner.query(`CREATE TABLE "waitlist_entry_action" ("id" SERIAL NOT NULL, "entryId" integer NOT NULL, "kind" "public"."waitlist_entry_action_kind_enum" NOT NULL, "staffUserId" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3fc85524af1f1c9e919e80becc0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_185e9f75e92999f6681ba29e3a" ON "waitlist_entry_action" ("entryId") `);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" ADD CONSTRAINT "FK_185e9f75e92999f6681ba29e3ac" FOREIGN KEY ("entryId") REFERENCES "waitlist_entry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" ADD CONSTRAINT "FK_869696716de5fcc680dd5f751cf" FOREIGN KEY ("staffUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" DROP CONSTRAINT "FK_869696716de5fcc680dd5f751cf"`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" DROP CONSTRAINT "FK_185e9f75e92999f6681ba29e3ac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_185e9f75e92999f6681ba29e3a"`);
        await queryRunner.query(`DROP TABLE "waitlist_entry_action"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_entry_action_kind_enum"`);
    }

}
