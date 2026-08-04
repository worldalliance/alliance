import { MigrationInterface, QueryRunner } from "typeorm";

export class TightenEntityNullability1785885138237 implements MigrationInterface {
    name = 'TightenEntityNullability1785885138237'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f5a7d64ef41260aecf95941796"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP CONSTRAINT "FK_614f018df34e5573ccdd46425fd"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ALTER COLUMN "memberActionEventId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_1ced25315eb974b73391fb1c81b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_groupingKey_category"`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP CONSTRAINT "FK_a6d6065cedd23f74e7ca5976059"`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP CONSTRAINT "FK_a172473353c73e761ea78a3f658"`);
        await queryRunner.query(`ALTER TABLE "community_invite" ALTER COLUMN "invitedUserId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "community_invite" ALTER COLUMN "communityId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_c72d82fa0e8699a141ed6cc41b3"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_7cf4a4df1f2627f72bf6231635f"`);
        await queryRunner.query(`ALTER TABLE "message" ALTER COLUMN "authorId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" ALTER COLUMN "conversationId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "FK_c03594530101ba8d1cf05bb137b"`);
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "FK_b915e97dea27ffd1e40c8003b3b"`);
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "UQ_3eb9345f4e759a2c536e69b9f6d"`);
        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "conversationId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract_event" DROP CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_570a9fcca47e3eb48546536d7f"`);
        await queryRunner.query(`ALTER TABLE "contract_event" DROP CONSTRAINT "UQ_fb9201b7927f167863569b10283"`);
        await queryRunner.query(`ALTER TABLE "contract_event" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "FK_77431e45d96b9c20941edf49df2"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "FK_e482969c0ef69f005533209143e"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "UQ_907157e850aae30cf8189e9cc54"`);
        await queryRunner.query(`ALTER TABLE "friend" ALTER COLUMN "requesterId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "friend" ALTER COLUMN "addresseeId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_device" DROP CONSTRAINT "FK_bda1afb30d9e3e8fb30b1e90af7"`);
        await queryRunner.query(`ALTER TABLE "user_device" ALTER COLUMN "userId" SET NOT NULL`);
        // 0 nulls in the staging copy of prod and @BeforeInsert has always
        // populated this, so this should be a no-op — but a SET NOT NULL that
        // finds one drifted row fails the deploy, and minting a code is what
        // the entity would have done.
        await queryRunner.query(`UPDATE "user" SET "referralCode" = substr(md5(random()::text || id::text), 1, 13) WHERE "referralCode" IS NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "referralCode" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP CONSTRAINT "FK_6fc20f9c69f4283d5ef0c05d5ba"`);
        await queryRunner.query(`ALTER TABLE "action_update" ALTER COLUMN "actionId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action_event" DROP CONSTRAINT "FK_18c6fac65146d867a3b8b721262"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6e446b5ec2f5b912fb6bfa1426"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b024b96d07ee747696b4377fe8"`);
        await queryRunner.query(`ALTER TABLE "action_event" ALTER COLUMN "actionId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "FK_30a4322efaa2df30f9cfbdf7e5f"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "unread_content" DROP CONSTRAINT "FK_26976ee92fe5427744a944a5241"`);
        await queryRunner.query(`ALTER TABLE "unread_content" ALTER COLUMN "userId" SET NOT NULL`);
        // Also 0 nulls in staging, but rows predating the key came from the
        // admin test push, which never set one. Backfill off the primary key so
        // each stays unique under the rebuilt index and can't collide with a
        // real key.
        await queryRunner.query(`UPDATE "push" SET "idempotencyKey" = 'legacy-' || "id" WHERE "idempotencyKey" IS NULL`);
        await queryRunner.query(`ALTER TABLE "push" ALTER COLUMN "idempotencyKey" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mms_optout" DROP CONSTRAINT "FK_3a18743d92584f7bd042704b3ba"`);
        await queryRunner.query(`ALTER TABLE "mms_optout" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("userId", "groupingKey", "category") `);
        await queryRunner.query(`CREATE INDEX "IDX_570a9fcca47e3eb48546536d7f" ON "contract_event" ("userId", "date") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e446b5ec2f5b912fb6bfa1426" ON "action_event" ("actionId", "newStatus", "date") `);
        await queryRunner.query(`CREATE INDEX "IDX_b024b96d07ee747696b4377fe8" ON "action_event" ("actionId", "date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b3b2d0922c85dbb07cc4696fb6" ON "push" ("idempotencyKey") `);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "UQ_3eb9345f4e759a2c536e69b9f6d" UNIQUE ("conversationId", "userId")`);
        await queryRunner.query(`ALTER TABLE "contract_event" ADD CONSTRAINT "UQ_fb9201b7927f167863569b10283" UNIQUE ("userId", "autoSuspendKey")`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "UQ_907157e850aae30cf8189e9cc54" UNIQUE ("requesterId", "addresseeId")`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD CONSTRAINT "FK_614f018df34e5573ccdd46425fd" FOREIGN KEY ("memberActionEventId") REFERENCES "action_event"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_1ced25315eb974b73391fb1c81b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD CONSTRAINT "FK_a6d6065cedd23f74e7ca5976059" FOREIGN KEY ("invitedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD CONSTRAINT "FK_a172473353c73e761ea78a3f658" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_c72d82fa0e8699a141ed6cc41b3" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_7cf4a4df1f2627f72bf6231635f" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "FK_c03594530101ba8d1cf05bb137b" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "FK_b915e97dea27ffd1e40c8003b3b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contract_event" ADD CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "FK_77431e45d96b9c20941edf49df2" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "FK_e482969c0ef69f005533209143e" FOREIGN KEY ("addresseeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_device" ADD CONSTRAINT "FK_bda1afb30d9e3e8fb30b1e90af7" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD CONSTRAINT "FK_6fc20f9c69f4283d5ef0c05d5ba" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_event" ADD CONSTRAINT "FK_18c6fac65146d867a3b8b721262" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "FK_30a4322efaa2df30f9cfbdf7e5f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "unread_content" ADD CONSTRAINT "FK_26976ee92fe5427744a944a5241" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mms_optout" ADD CONSTRAINT "FK_3a18743d92584f7bd042704b3ba" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mms_optout" DROP CONSTRAINT "FK_3a18743d92584f7bd042704b3ba"`);
        await queryRunner.query(`ALTER TABLE "unread_content" DROP CONSTRAINT "FK_26976ee92fe5427744a944a5241"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "FK_30a4322efaa2df30f9cfbdf7e5f"`);
        await queryRunner.query(`ALTER TABLE "action_event" DROP CONSTRAINT "FK_18c6fac65146d867a3b8b721262"`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP CONSTRAINT "FK_6fc20f9c69f4283d5ef0c05d5ba"`);
        await queryRunner.query(`ALTER TABLE "user_device" DROP CONSTRAINT "FK_bda1afb30d9e3e8fb30b1e90af7"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "FK_e482969c0ef69f005533209143e"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "FK_77431e45d96b9c20941edf49df2"`);
        await queryRunner.query(`ALTER TABLE "contract_event" DROP CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976"`);
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "FK_b915e97dea27ffd1e40c8003b3b"`);
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "FK_c03594530101ba8d1cf05bb137b"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_7cf4a4df1f2627f72bf6231635f"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_c72d82fa0e8699a141ed6cc41b3"`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP CONSTRAINT "FK_a172473353c73e761ea78a3f658"`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP CONSTRAINT "FK_a6d6065cedd23f74e7ca5976059"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_1ced25315eb974b73391fb1c81b"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP CONSTRAINT "FK_614f018df34e5573ccdd46425fd"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "UQ_907157e850aae30cf8189e9cc54"`);
        await queryRunner.query(`ALTER TABLE "contract_event" DROP CONSTRAINT "UQ_fb9201b7927f167863569b10283"`);
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "UQ_3eb9345f4e759a2c536e69b9f6d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3b2d0922c85dbb07cc4696fb6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b024b96d07ee747696b4377fe8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6e446b5ec2f5b912fb6bfa1426"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_570a9fcca47e3eb48546536d7f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_groupingKey_category"`);
        await queryRunner.query(`ALTER TABLE "mms_optout" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mms_optout" ADD CONSTRAINT "FK_3a18743d92584f7bd042704b3ba" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "push" ALTER COLUMN "idempotencyKey" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "unread_content" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "unread_content" ADD CONSTRAINT "FK_26976ee92fe5427744a944a5241" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "FK_30a4322efaa2df30f9cfbdf7e5f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_event" ALTER COLUMN "actionId" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_b024b96d07ee747696b4377fe8" ON "action_event" ("actionId", "date") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e446b5ec2f5b912fb6bfa1426" ON "action_event" ("actionId", "date", "newStatus") `);
        await queryRunner.query(`ALTER TABLE "action_event" ADD CONSTRAINT "FK_18c6fac65146d867a3b8b721262" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_update" ALTER COLUMN "actionId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD CONSTRAINT "FK_6fc20f9c69f4283d5ef0c05d5ba" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "referralCode" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_device" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_device" ADD CONSTRAINT "FK_bda1afb30d9e3e8fb30b1e90af7" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friend" ALTER COLUMN "addresseeId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "friend" ALTER COLUMN "requesterId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "UQ_907157e850aae30cf8189e9cc54" UNIQUE ("requesterId", "addresseeId")`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "FK_e482969c0ef69f005533209143e" FOREIGN KEY ("addresseeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "FK_77431e45d96b9c20941edf49df2" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contract_event" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract_event" ADD CONSTRAINT "UQ_fb9201b7927f167863569b10283" UNIQUE ("userId", "autoSuspendKey")`);
        await queryRunner.query(`CREATE INDEX "IDX_570a9fcca47e3eb48546536d7f" ON "contract_event" ("date", "userId") `);
        await queryRunner.query(`ALTER TABLE "contract_event" ADD CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "conversationId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "UQ_3eb9345f4e759a2c536e69b9f6d" UNIQUE ("conversationId", "userId")`);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "FK_b915e97dea27ffd1e40c8003b3b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "FK_c03594530101ba8d1cf05bb137b" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ALTER COLUMN "conversationId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" ALTER COLUMN "authorId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_7cf4a4df1f2627f72bf6231635f" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_c72d82fa0e8699a141ed6cc41b3" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_invite" ALTER COLUMN "communityId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "community_invite" ALTER COLUMN "invitedUserId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD CONSTRAINT "FK_a172473353c73e761ea78a3f658" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD CONSTRAINT "FK_a6d6065cedd23f74e7ca5976059" FOREIGN KEY ("invitedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("category", "groupingKey", "userId") `);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_1ced25315eb974b73391fb1c81b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ALTER COLUMN "memberActionEventId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD CONSTRAINT "FK_614f018df34e5573ccdd46425fd" FOREIGN KEY ("memberActionEventId") REFERENCES "action_event"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f5a7d64ef41260aecf95941796" ON "push" ("idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL)`);
    }

}
