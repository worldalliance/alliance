import { MigrationInterface, QueryRunner } from 'typeorm';

export class InviteGroupAssignment1785451704705 implements MigrationInterface {
  name = 'InviteGroupAssignment1785451704705';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."share_url_inviteassignmentkind_enum" AS ENUM('community', 'open')`,
    );
    await queryRunner.query(
      `ALTER TABLE "share_url" ADD "inviteAssignmentKind" "public"."share_url_inviteassignmentkind_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "share_url" ADD "inviteAssignmentCommunityId" integer`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_inviteassignmentkind_enum" AS ENUM('community', 'open')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "inviteAssignmentKind" "public"."user_inviteassignmentkind_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "inviteAssignmentCommunityId" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3476833c4b18b10f8e7a65a2d6" ON "user" ("referredByShareUrlId") `,
    );
    await queryRunner.query(`ALTER TABLE "share_url" ADD CONSTRAINT "CHK_share_url_invite_assignment" CHECK (("inviteAssignmentKind" IS NULL OR "kind" = 'invite')
   AND ("inviteAssignmentCommunityId" IS NULL
        OR "inviteAssignmentKind" IS NOT DISTINCT FROM 'community'))`);
    await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "CHK_user_invite_assignment" CHECK ("inviteAssignmentCommunityId" IS NULL
   OR "inviteAssignmentKind" IS NOT DISTINCT FROM 'community')`);
    await queryRunner.query(
      `ALTER TABLE "share_url" ADD CONSTRAINT "FK_51b7bb63a9d6b8792ff0ed87d3e" FOREIGN KEY ("inviteAssignmentCommunityId") REFERENCES "community"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_390e9b6983b98f397aed3a854ec" FOREIGN KEY ("inviteAssignmentCommunityId") REFERENCES "community"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // Move the assignment out of `data` before that column goes. The lookup
    // leaves the community id null when the named group is already gone, which
    // is the same state the new FK reaches by deletion, and which placement
    // reads as "named a destination, and it no longer exists".
    await queryRunner.query(`
      UPDATE "share_url" su
      SET "inviteAssignmentKind" =
            (su."data" #>> '{inviteAssignment,kind}')::"public"."share_url_inviteassignmentkind_enum",
          "inviteAssignmentCommunityId" = (
            SELECT c."id" FROM "community" c
            WHERE c."id" = CASE
              WHEN su."data" #>> '{inviteAssignment,communityId}' ~ '^[0-9]+$'
              THEN (su."data" #>> '{inviteAssignment,communityId}')::int
            END
          )
      WHERE su."kind" = 'invite'
        AND su."data" #>> '{inviteAssignment,kind}' IN ('community', 'open')
    `);

    // Snapshot onto signups that predate the copy, so placement for anyone who
    // has not signed their contract yet survives deletion of the invite link.
    // Read off the columns just written rather than `data` again, so the two
    // records of the same assignment cannot disagree.
    await queryRunner.query(`
      UPDATE "user" u
      SET "inviteAssignmentKind" =
            su."inviteAssignmentKind"::text::"public"."user_inviteassignmentkind_enum",
          "inviteAssignmentCommunityId" = su."inviteAssignmentCommunityId"
      FROM "share_url" su
      WHERE u."referredByShareUrlId" = su."id"
        AND su."inviteAssignmentKind" IS NOT NULL
    `);

    // `sid` got its own column without a backfill, so rows predating it carry
    // theirs only in `data`. Nothing else was ever stored there.
    await queryRunner.query(
      `UPDATE "share_url" SET "sid" = "data" ->> 'sid' WHERE "sid" IS NULL AND "data" ? 'sid'`,
    );
    await queryRunner.query(`ALTER TABLE "share_url" DROP COLUMN "data"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "share_url" ADD "data" jsonb`);
    // A community assignment whose group has since been deleted has no form in
    // the old shape — its id was required there — so it rolls back as a link
    // that names nowhere, which is how the old code read it once the group was
    // gone.
    await queryRunner.query(`
      UPDATE "share_url"
      SET "data" = jsonb_strip_nulls(jsonb_build_object('sid', "sid"))
        || CASE
             WHEN "inviteAssignmentKind" = 'community'
                  AND "inviteAssignmentCommunityId" IS NOT NULL
               THEN jsonb_build_object(
                      'inviteAssignment',
                      jsonb_build_object(
                        'kind', 'community',
                        'communityId', "inviteAssignmentCommunityId"
                      )
                    )
             WHEN "inviteAssignmentKind" = 'open'
               THEN jsonb_build_object(
                      'inviteAssignment', jsonb_build_object('kind', 'open')
                    )
             ELSE '{}'::jsonb
           END
    `);
    await queryRunner.query(
      `ALTER TABLE "share_url" ALTER COLUMN "data" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_390e9b6983b98f397aed3a854ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "share_url" DROP CONSTRAINT "FK_51b7bb63a9d6b8792ff0ed87d3e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "CHK_user_invite_assignment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "share_url" DROP CONSTRAINT "CHK_share_url_invite_assignment"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3476833c4b18b10f8e7a65a2d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "inviteAssignmentCommunityId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "inviteAssignmentKind"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."user_inviteassignmentkind_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "share_url" DROP COLUMN "inviteAssignmentCommunityId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "share_url" DROP COLUMN "inviteAssignmentKind"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."share_url_inviteassignmentkind_enum"`,
    );
  }
}
