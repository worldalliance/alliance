import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionBranches1794259036924 implements MigrationInterface {
  name = "ActionBranches1794259036924";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "action_branch" ("id" SERIAL NOT NULL, "actionId" integer NOT NULL, "formId" integer NOT NULL, "name" text NOT NULL, "rule" jsonb NOT NULL, "position" integer NOT NULL, "nameOverride" character varying, "shortDescriptionOverride" character varying, "bodyOverride" character varying, "timeEstimateOverride" integer, "imageOverride" character varying, "squareThumbnailImageOverride" character varying, "squareThumbnailImageAltOverride" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4fdc376d7cab3c4341fb8c92ed5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_action_branch_formId" ON "action_branch" ("formId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_action_branch_actionId" ON "action_branch" ("actionId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" ADD "branchId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" ADD "overriddenAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" ADD "overriddenById" integer`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_user_groupingKey_category"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notification_category_enum" RENAME TO "notification_category_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_category_enum" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'member_joined_community', 'community_assigned', 'new_member_referred', 'group_member_joined', 'action_branch_moved', 'contract_reinstated', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'ambassador_invite_goal')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum" USING "category"::"text"::"public"."notification_category_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."notification_category_enum_old"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("userId", "groupingKey", "category") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_action_form_assignment_branchId" ON "action_form_assignment" ("branchId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" ADD CONSTRAINT "CHK_action_form_assignment_variant_or_branch" CHECK ("variantId" IS NULL OR "branchId" IS NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_branch" ADD CONSTRAINT "FK_cb9dafe0a23036dcd36560ffdbb" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_branch" ADD CONSTRAINT "FK_4d0f275ca6cf8268702c887eea4" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" ADD CONSTRAINT "FK_8fcac719d6787adbde6f90c8da2" FOREIGN KEY ("branchId") REFERENCES "action_branch"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" ADD CONSTRAINT "FK_576e190435058471e684a8ae8d4" FOREIGN KEY ("overriddenById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" DROP CONSTRAINT "FK_576e190435058471e684a8ae8d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" DROP CONSTRAINT "FK_8fcac719d6787adbde6f90c8da2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_branch" DROP CONSTRAINT "FK_4d0f275ca6cf8268702c887eea4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_branch" DROP CONSTRAINT "FK_cb9dafe0a23036dcd36560ffdbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" DROP CONSTRAINT "CHK_action_form_assignment_variant_or_branch"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_action_form_assignment_branchId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_user_groupingKey_category"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_category_enum_old" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'member_joined_community', 'community_assigned', 'new_member_referred', 'group_member_joined', 'contract_reinstated', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'ambassador_invite_goal')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum_old" USING "category"::"text"::"public"."notification_category_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notification_category_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notification_category_enum_old" RENAME TO "notification_category_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("category", "groupingKey", "userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" DROP COLUMN "overriddenById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" DROP COLUMN "overriddenAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_form_assignment" DROP COLUMN "branchId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_action_branch_actionId"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_action_branch_formId"`);
    await queryRunner.query(`DROP TABLE "action_branch"`);
  }
}
