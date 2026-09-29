import { MigrationInterface, QueryRunner } from "typeorm";

export class Waitlist1790721123083 implements MigrationInterface {
    name = 'Waitlist1790721123083'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "waitlist_link" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "organizationId" integer NOT NULL, "channel" character varying NOT NULL, "publishedAt" TIMESTAMP WITH TIME ZONE, "archivedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_80d778e515f6e7620af6e3708f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0d9c0a6916726a42fe3d7a1d23" ON "waitlist_link" ("code") `);
        await queryRunner.query(`CREATE TABLE "waitlist_entry" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" citext NOT NULL, "reason" text, "committedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "code" character varying NOT NULL, "organizationId" integer, "sourceLinkId" integer, "referrerId" integer, "mobilizedAt" TIMESTAMP WITH TIME ZONE, "unsubscribedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_waitlist_entry_email_trimmed" CHECK ("email" !~ '^[[:space:]]|[[:space:]]$'), CONSTRAINT "CHK_waitlist_entry_reason" CHECK ("organizationId" IS NOT NULL OR coalesce("reason", '') ~ '[^[:space:]]'), CONSTRAINT "PK_77e5b27d89e0b1795ea07ef32f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c44e503e5201bd169f7269f450" ON "waitlist_entry" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_362284c2238a42fc8176ee5daa" ON "waitlist_entry" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_52b232bcd704c08f4d929756e4" ON "waitlist_entry" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d5e93d7d7db42e3612d3227f7" ON "waitlist_entry" ("sourceLinkId") `);
        await queryRunner.query(`CREATE INDEX "IDX_776d2f1314906c7459558fe3d9" ON "waitlist_entry" ("referrerId") `);
        await queryRunner.query(`ALTER TABLE "waitlist_link" ADD CONSTRAINT "FK_16879f395cd080ea86a4745dcee" FOREIGN KEY ("organizationId") REFERENCES "campaign"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD CONSTRAINT "FK_52b232bcd704c08f4d929756e42" FOREIGN KEY ("organizationId") REFERENCES "campaign"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD CONSTRAINT "FK_9d5e93d7d7db42e3612d3227f71" FOREIGN KEY ("sourceLinkId") REFERENCES "waitlist_link"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD CONSTRAINT "FK_776d2f1314906c7459558fe3d94" FOREIGN KEY ("referrerId") REFERENCES "waitlist_entry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP CONSTRAINT "FK_776d2f1314906c7459558fe3d94"`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP CONSTRAINT "FK_9d5e93d7d7db42e3612d3227f71"`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP CONSTRAINT "FK_52b232bcd704c08f4d929756e42"`);
        await queryRunner.query(`ALTER TABLE "waitlist_link" DROP CONSTRAINT "FK_16879f395cd080ea86a4745dcee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_776d2f1314906c7459558fe3d9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d5e93d7d7db42e3612d3227f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52b232bcd704c08f4d929756e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_362284c2238a42fc8176ee5daa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c44e503e5201bd169f7269f450"`);
        await queryRunner.query(`DROP TABLE "waitlist_entry"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d9c0a6916726a42fe3d7a1d23"`);
        await queryRunner.query(`DROP TABLE "waitlist_link"`);
    }

}
