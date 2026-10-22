import { MigrationInterface, QueryRunner } from "typeorm";

export class OrganizationInvite1790721147669 implements MigrationInterface {
    name = 'OrganizationInvite1790721147669'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD "organizationId" integer`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD "waitlistEntryId" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_0c9f38dcf9deb4f7b067fea2ae" ON "onetime_invite" ("waitlistEntryId") `);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD CONSTRAINT "CHK_onetime_invite_issuer" CHECK ("invitingUserId" IS NULL OR "organizationId" IS NULL)`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD CONSTRAINT "FK_74313d161063e55445a2d3cbccc" FOREIGN KEY ("organizationId") REFERENCES "campaign"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD CONSTRAINT "FK_0c9f38dcf9deb4f7b067fea2ae4" FOREIGN KEY ("waitlistEntryId") REFERENCES "waitlist_entry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP CONSTRAINT "FK_0c9f38dcf9deb4f7b067fea2ae4"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP CONSTRAINT "FK_74313d161063e55445a2d3cbccc"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP CONSTRAINT "CHK_onetime_invite_issuer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c9f38dcf9deb4f7b067fea2ae"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP COLUMN "waitlistEntryId"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP COLUMN "organizationId"`);
    }

}
