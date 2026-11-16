import { MigrationInterface, QueryRunner } from "typeorm";

export class MarkTextsHandled1794871480852 implements MigrationInterface {
    name = 'MarkTextsHandled1794871480852'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."mms_thread_event_kind_enum" AS ENUM('marked_handled', 'marked_needs_reply')`);
        await queryRunner.query(`CREATE TABLE "mms_thread_event" ("id" SERIAL NOT NULL, "kind" "public"."mms_thread_event_kind_enum" NOT NULL, "afterMmsId" integer NOT NULL, "markedById" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9ed839feb3267bb9c67e67f08e1" PRIMARY KEY ("id")); COMMENT ON COLUMN "mms_thread_event"."afterMmsId" IS 'The newest text staff could see, which the event follows'`);
        await queryRunner.query(`CREATE INDEX "IDX_e6817bf5adc8cf7075dc4d67a0" ON "mms_thread_event" ("afterMmsId") `);
        await queryRunner.query(`ALTER TABLE "mms" ADD "handledEventId" integer`);
        await queryRunner.query(`COMMENT ON COLUMN "mms"."handledEventId" IS 'The mark handled that took this inbound text off Needs reply without a reply'`);
        await queryRunner.query(`ALTER TABLE "mms_thread_event" ADD CONSTRAINT "FK_e6817bf5adc8cf7075dc4d67a0b" FOREIGN KEY ("afterMmsId") REFERENCES "mms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mms_thread_event" ADD CONSTRAINT "FK_85da5afb028f3064d00497326fd" FOREIGN KEY ("markedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mms" ADD CONSTRAINT "FK_33d23bd14ea6023eb521a17f57b" FOREIGN KEY ("handledEventId") REFERENCES "mms_thread_event"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mms" DROP CONSTRAINT "FK_33d23bd14ea6023eb521a17f57b"`);
        await queryRunner.query(`ALTER TABLE "mms_thread_event" DROP CONSTRAINT "FK_85da5afb028f3064d00497326fd"`);
        await queryRunner.query(`ALTER TABLE "mms_thread_event" DROP CONSTRAINT "FK_e6817bf5adc8cf7075dc4d67a0b"`);
        await queryRunner.query(`COMMENT ON COLUMN "mms"."handledEventId" IS 'The mark handled that took this inbound text off Needs reply without a reply'`);
        await queryRunner.query(`ALTER TABLE "mms" DROP COLUMN "handledEventId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6817bf5adc8cf7075dc4d67a0"`);
        await queryRunner.query(`DROP TABLE "mms_thread_event"`);
        await queryRunner.query(`DROP TYPE "public"."mms_thread_event_kind_enum"`);
    }

}
