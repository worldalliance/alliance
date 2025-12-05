import { MigrationInterface, QueryRunner } from "typeorm";

export class SplitOnetimeInviteRequests1764893652492 implements MigrationInterface {
    name = 'SplitOnetimeInviteRequests1764893652492'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "onetime_invite_request" ("id" SERIAL NOT NULL, "invitee" character varying NOT NULL, "inviteeDescription" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "invitingUserId" integer, "communityId" integer, CONSTRAINT "PK_44edb7bc42046b57df3e46aaa0f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP COLUMN "approved"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP COLUMN "inviteeDescription"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite_request" ADD CONSTRAINT "FK_e42b68a56b3c9e93e7d612001ff" FOREIGN KEY ("invitingUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "onetime_invite_request" ADD CONSTRAINT "FK_d4f29888717b1fc7ef88d2acbd5" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onetime_invite_request" DROP CONSTRAINT "FK_d4f29888717b1fc7ef88d2acbd5"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite_request" DROP CONSTRAINT "FK_e42b68a56b3c9e93e7d612001ff"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD "inviteeDescription" character varying`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD "approved" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`DROP TABLE "onetime_invite_request"`);
    }

}
