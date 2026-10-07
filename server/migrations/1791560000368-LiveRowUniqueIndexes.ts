import { MigrationInterface, QueryRunner } from "typeorm";

export class LiveRowUniqueIndexes1791560000368 implements MigrationInterface {
    name = 'LiveRowUniqueIndexes1791560000368'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_55a2f3f5ea82d21f74c7df0fd9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b593a947464d9f6f06a47b9226"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d0bbf9841927360ccb23062f7"`);
        await queryRunner.query(`ALTER TABLE "oauth_account" DROP CONSTRAINT "UQ_8b7ff18465972f261dacf3fe935"`);
        await queryRunner.query(`ALTER TABLE "oauth_account" DROP CONSTRAINT "UQ_ffe532125ea5d5e03a0bc76da41"`);
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "UQ_3eb9345f4e759a2c536e69b9f6d"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "UQ_f9beaaa6321980892c394bdb137"`);
        await queryRunner.query(`ALTER TABLE "post_tag" DROP CONSTRAINT "UQ_5a3b3ec40482829ef5537f7e87f"`);
        await queryRunner.query(`ALTER TABLE "form_response_draft" DROP CONSTRAINT "UQ_4ddf761a4156ad0cc1ead328c4d"`);
        await queryRunner.query(`ALTER TABLE "action_form_assignment" DROP CONSTRAINT "UQ_action_form_assignment_actionId_userId"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP CONSTRAINT "FK_a20a894fd6e83f41e2ff73e9f93"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP CONSTRAINT "UQ_action_form_variant_formId"`);
        await queryRunner.query(`ALTER TABLE "tag" DROP CONSTRAINT "UQ_6a9775008add570dc3e5a0bab7b"`);
        await queryRunner.query(`ALTER TABLE "project" DROP CONSTRAINT "UQ_dedfea394088ed136ddadeee89c"`);
        await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "UQ_21c0329044bd977340b9c86c2cf"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_cabc48e77be83f96838b9d394a1"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "UQ_cabc48e77be83f96838b9d394a1"`);
        await queryRunner.query(`ALTER TABLE "user_device" DROP CONSTRAINT "UQ_f7d5749a78e508db745facb2c3d"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22"`);
        // migration:generate does not diff a partial index's predicate.
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_user_action"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_user_action" ON "share_url" ("userId", "actionId") WHERE "actionId" IS NOT NULL AND "duplicate" = false AND "deletedAt" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_user_external_target"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_user_external_target" ON "share_url" ("userId", "externalTargetId") WHERE "externalTargetId" IS NOT NULL AND "duplicate" = false AND "deletedAt" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_campaign_action"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_campaign_action" ON "share_url" ("campaignId", "actionId") WHERE "actionId" IS NOT NULL AND "campaignId" IS NOT NULL AND "duplicate" = false AND "deletedAt" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_campaign_external_target"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_campaign_external_target" ON "share_url" ("campaignId", "externalTargetId") WHERE "externalTargetId" IS NOT NULL AND "campaignId" IS NOT NULL AND "duplicate" = false AND "deletedAt" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_user_invite"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_user_invite" ON "share_url" ("userId") WHERE "kind" = 'invite' AND "userId" IS NOT NULL AND "duplicate" = false AND "deletedAt" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_campaign_invite"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_campaign_invite" ON "share_url" ("campaignId") WHERE "kind" = 'invite' AND "campaignId" IS NOT NULL AND "duplicate" = false AND "deletedAt" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."UQ_action_event_one_member_action"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_action_event_one_member_action" ON "action_event" ("actionId") WHERE "newStatus" = 'member_action' AND "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_action_form_variant_formId" ON "action_form_variant" ("formId") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd1f6114ee879104d9da5d3124"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f74bc17dc2a25d9b5b39ef611d" ON "tag" ("name") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d3f1f9a9f1687ece94f3ae5132" ON "custom_link" ("slug") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a5ca5c04c9bb3b8fd7bda28d09" ON "project" ("name") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_db45796939e09a53a1489a9368" ON "action" ("taskFormId") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2fe5ef1d0bc2bad75124b9ee98" ON "oauth_account" ("userId", "provider") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_afbba0db74c54520dbfadcfc22" ON "oauth_account" ("provider", "subject") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_258c175fe54945e4c146d7f1aa" ON "conversation" ("communityId") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8689724177cace5fb8bc5e5976" ON "participant" ("conversationId", "userId") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8228393d1b3dfeb0f6588c66e0" ON "friend" ("lowUserId", "highUserId") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ec34b6f6717d56f72e7e326e3f" ON "user_device" ("expoPushToken") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d0012b9482ca5b4f270e6fdb5e" ON "user" ("email") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5d8a28022f04411f491a1a81f7" ON "waitlist_tag" ("name") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_280ab9b99e6d717a1b2d1c6238" ON "waitlist_email_template" ("name") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1fdde21f5208f8417a823bfbc9" ON "waitlist_cohort" ("name") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c7409dec896b7d30406006f94e" ON "form_response_draft" ("userId", "formId") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_action_form_assignment_actionId_userId" ON "action_form_assignment" ("actionId", "userId") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "post_tag" ADD CONSTRAINT "EX_post_tag_postId_name" EXCLUDE USING btree ("postId" WITH =, "name" WITH =) WHERE ("deletedAt" IS NULL) DEFERRABLE INITIALLY DEFERRED`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD CONSTRAINT "FK_a20a894fd6e83f41e2ff73e9f93" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "FK_cabc48e77be83f96838b9d394a1" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "IDX_action_form_variant_formId" ON "action_form_variant" ("formId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a9124d5956d6244b17bdd67f92" ON "oauth_account" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cabc48e77be83f96838b9d394a" ON "conversation" ("communityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c03594530101ba8d1cf05bb137" ON "participant" ("conversationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_444c1b4f6cd7b632277f557935" ON "post_tag" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_37e5606ebf2387f24d482ea54a" ON "form_response_draft" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_action_form_assignment_actionId" ON "action_form_assignment" ("actionId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The full unique constraints below fail once a deleted row's email, name
        // or key has been reused; physically delete those rows by hand before
        // reverting.
        await queryRunner.query(`DROP INDEX "public"."IDX_action_form_assignment_actionId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_37e5606ebf2387f24d482ea54a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_444c1b4f6cd7b632277f557935"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c03594530101ba8d1cf05bb137"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cabc48e77be83f96838b9d394a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a9124d5956d6244b17bdd67f92"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_action_form_variant_formId"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_user_action"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_user_action" ON "share_url" ("userId", "actionId") WHERE "actionId" IS NOT NULL AND "duplicate" = false`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_user_external_target"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_user_external_target" ON "share_url" ("userId", "externalTargetId") WHERE "externalTargetId" IS NOT NULL AND "duplicate" = false`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_campaign_action"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_campaign_action" ON "share_url" ("campaignId", "actionId") WHERE "actionId" IS NOT NULL AND "campaignId" IS NOT NULL AND "duplicate" = false`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_campaign_external_target"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_campaign_external_target" ON "share_url" ("campaignId", "externalTargetId") WHERE "externalTargetId" IS NOT NULL AND "campaignId" IS NOT NULL AND "duplicate" = false`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_user_invite"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_user_invite" ON "share_url" ("userId") WHERE "kind" = 'invite' AND "userId" IS NOT NULL AND "duplicate" = false`);
        await queryRunner.query(`DROP INDEX "public"."UQ_share_url_campaign_invite"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_share_url_campaign_invite" ON "share_url" ("campaignId") WHERE "kind" = 'invite' AND "campaignId" IS NOT NULL AND "duplicate" = false`);
        await queryRunner.query(`DROP INDEX "public"."UQ_action_event_one_member_action"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_action_event_one_member_action" ON "action_event" ("actionId") WHERE "newStatus" = 'member_action'`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_cabc48e77be83f96838b9d394a1"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP CONSTRAINT "FK_a20a894fd6e83f41e2ff73e9f93"`);
        await queryRunner.query(`ALTER TABLE "post_tag" DROP CONSTRAINT "EX_post_tag_postId_name"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_action_form_assignment_actionId_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c7409dec896b7d30406006f94e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1fdde21f5208f8417a823bfbc9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_280ab9b99e6d717a1b2d1c6238"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5d8a28022f04411f491a1a81f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d0012b9482ca5b4f270e6fdb5e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec34b6f6717d56f72e7e326e3f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8228393d1b3dfeb0f6588c66e0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8689724177cace5fb8bc5e5976"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_258c175fe54945e4c146d7f1aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_afbba0db74c54520dbfadcfc22"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2fe5ef1d0bc2bad75124b9ee98"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db45796939e09a53a1489a9368"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a5ca5c04c9bb3b8fd7bda28d09"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3f1f9a9f1687ece94f3ae5132"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f74bc17dc2a25d9b5b39ef611d"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bd1f6114ee879104d9da5d3124" ON "custom_link" ("slug") `);
        await queryRunner.query(`DROP INDEX "public"."UQ_action_form_variant_formId"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "user_device" ADD CONSTRAINT "UQ_f7d5749a78e508db745facb2c3d" UNIQUE ("expoPushToken")`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "UQ_cabc48e77be83f96838b9d394a1" UNIQUE ("communityId")`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "FK_cabc48e77be83f96838b9d394a1" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action" ADD CONSTRAINT "UQ_21c0329044bd977340b9c86c2cf" UNIQUE ("taskFormId")`);
        await queryRunner.query(`ALTER TABLE "project" ADD CONSTRAINT "UQ_dedfea394088ed136ddadeee89c" UNIQUE ("name")`);
        await queryRunner.query(`ALTER TABLE "tag" ADD CONSTRAINT "UQ_6a9775008add570dc3e5a0bab7b" UNIQUE ("name")`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD CONSTRAINT "UQ_action_form_variant_formId" UNIQUE ("formId")`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD CONSTRAINT "FK_a20a894fd6e83f41e2ff73e9f93" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_form_assignment" ADD CONSTRAINT "UQ_action_form_assignment_actionId_userId" UNIQUE ("actionId", "userId")`);
        await queryRunner.query(`ALTER TABLE "form_response_draft" ADD CONSTRAINT "UQ_4ddf761a4156ad0cc1ead328c4d" UNIQUE ("userId", "formId")`);
        await queryRunner.query(`ALTER TABLE "post_tag" ADD CONSTRAINT "UQ_5a3b3ec40482829ef5537f7e87f" UNIQUE ("postId", "name") DEFERRABLE INITIALLY DEFERRED`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "UQ_f9beaaa6321980892c394bdb137" UNIQUE ("lowUserId", "highUserId")`);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "UQ_3eb9345f4e759a2c536e69b9f6d" UNIQUE ("conversationId", "userId")`);
        await queryRunner.query(`ALTER TABLE "oauth_account" ADD CONSTRAINT "UQ_ffe532125ea5d5e03a0bc76da41" UNIQUE ("provider", "subject")`);
        await queryRunner.query(`ALTER TABLE "oauth_account" ADD CONSTRAINT "UQ_8b7ff18465972f261dacf3fe935" UNIQUE ("userId", "provider")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9d0bbf9841927360ccb23062f7" ON "waitlist_cohort" ("name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b593a947464d9f6f06a47b9226" ON "waitlist_email_template" ("name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_55a2f3f5ea82d21f74c7df0fd9" ON "waitlist_tag" ("name") `);
    }

}
