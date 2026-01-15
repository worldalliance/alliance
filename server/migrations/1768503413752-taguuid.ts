import { MigrationInterface, QueryRunner } from 'typeorm';

export class Taguuid1768503413752 implements MigrationInterface {
  name = 'Taguuid1768503413752';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 1) Add temporary UUID column on tag and backfill
    await queryRunner.query(`ALTER TABLE "tag" ADD "id_uuid" uuid`);
    await queryRunner.query(
      `UPDATE "tag" SET "id_uuid" = uuid_generate_v4() WHERE "id_uuid" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag" ALTER COLUMN "id_uuid" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag" ALTER COLUMN "id_uuid" SET DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_tag_id_uuid" ON "tag" ("id_uuid")`,
    );

    // 2) Add UUID FK columns to referencing tables and backfill from tag.id → tag.id_uuid

    // action_update.tagId
    await queryRunner.query(
      `ALTER TABLE "action_update" ADD "tagId_uuid" uuid`,
    );
    await queryRunner.query(`
          UPDATE "action_update" au
          SET "tagId_uuid" = t."id_uuid"
          FROM "tag" t
          WHERE au."tagId" = t."id"
        `);

    // reminder_group.userTagId
    await queryRunner.query(
      `ALTER TABLE "reminder_group" ADD "userTagId_uuid" uuid`,
    );
    await queryRunner.query(`
          UPDATE "reminder_group" rg
          SET "userTagId_uuid" = t."id_uuid"
          FROM "tag" t
          WHERE rg."userTagId" = t."id"
        `);

    // tag_users_user.tagId
    await queryRunner.query(
      `ALTER TABLE "tag_users_user" ADD "tagId_uuid" uuid`,
    );
    await queryRunner.query(`
          UPDATE "tag_users_user" tu
          SET "tagId_uuid" = t."id_uuid"
          FROM "tag" t
          WHERE tu."tagId" = t."id"
        `);
    await queryRunner.query(
      `ALTER TABLE "tag_users_user" ALTER COLUMN "tagId_uuid" SET NOT NULL`,
    );

    // tag_participating_in_action.tagId
    await queryRunner.query(
      `ALTER TABLE "tag_participating_in_action" ADD "tagId_uuid" uuid`,
    );
    await queryRunner.query(`
          UPDATE "tag_participating_in_action" tp
          SET "tagId_uuid" = t."id_uuid"
          FROM "tag" t
          WHERE tp."tagId" = t."id"
        `);
    await queryRunner.query(
      `ALTER TABLE "tag_participating_in_action" ALTER COLUMN "tagId_uuid" SET NOT NULL`,
    );

    // action_participating_tags_tag.tagId
    await queryRunner.query(
      `ALTER TABLE "action_participating_tags_tag" ADD "tagId_uuid" uuid`,
    );
    await queryRunner.query(`
          UPDATE "action_participating_tags_tag" apt
          SET "tagId_uuid" = t."id_uuid"
          FROM "tag" t
          WHERE apt."tagId" = t."id"
        `);
    await queryRunner.query(
      `ALTER TABLE "action_participating_tags_tag" ALTER COLUMN "tagId_uuid" SET NOT NULL`,
    );

    // 3) Drop existing FKs that reference tag(id)
    await queryRunner.query(
      `ALTER TABLE "action_participating_tags_tag" DROP CONSTRAINT "FK_488f25c6897226813db2de109eb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_participating_in_action" DROP CONSTRAINT "FK_b0a20bd6ef1b97861a20e194b99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_users_user" DROP CONSTRAINT "FK_ac2dc02851d77738e7aba2782fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminder_group" DROP CONSTRAINT "FK_dbb157db646be57f5e14f7deedf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update" DROP CONSTRAINT "FK_de574ee379db67b585ac575549e"`,
    );

    // 4) Update join-table PKs to use UUID columns (requires dropping/recreating PKs)

    // tag_users_user: PK(tagId, userId)
    await queryRunner.query(
      `ALTER TABLE "tag_users_user" DROP CONSTRAINT "PK_095c7eb736c8f563d9066c8b0a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_users_user" RENAME COLUMN "tagId" TO "tagId_int"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_users_user" RENAME COLUMN "tagId_uuid" TO "tagId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_users_user" ADD CONSTRAINT "PK_095c7eb736c8f563d9066c8b0a6" PRIMARY KEY ("tagId", "userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_users_user" DROP COLUMN "tagId_int"`,
    );

    // tag_participating_in_action: PK(tagId, actionId)
    await queryRunner.query(
      `ALTER TABLE "tag_participating_in_action" DROP CONSTRAINT "PK_368d457b6a338de19d40a37b8a5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_participating_in_action" RENAME COLUMN "tagId" TO "tagId_int"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_participating_in_action" RENAME COLUMN "tagId_uuid" TO "tagId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_participating_in_action" ADD CONSTRAINT "PK_368d457b6a338de19d40a37b8a5" PRIMARY KEY ("tagId", "actionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_participating_in_action" DROP COLUMN "tagId_int"`,
    );

    // action_participating_tags_tag: PK(actionId, tagId)
    await queryRunner.query(
      `ALTER TABLE "action_participating_tags_tag" DROP CONSTRAINT "PK_0a6c24ad104c01e8fb53ceaa543"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_participating_tags_tag" RENAME COLUMN "tagId" TO "tagId_int"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_participating_tags_tag" RENAME COLUMN "tagId_uuid" TO "tagId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_participating_tags_tag" ADD CONSTRAINT "PK_0a6c24ad104c01e8fb53ceaa543" PRIMARY KEY ("actionId", "tagId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_participating_tags_tag" DROP COLUMN "tagId_int"`,
    );

    // 5) Swap simple FK columns (no PK involvement) to use UUID

    // action_update.tagId
    await queryRunner.query(
      `ALTER TABLE "action_update" RENAME COLUMN "tagId" TO "tagId_int"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update" RENAME COLUMN "tagId_uuid" TO "tagId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update" DROP COLUMN "tagId_int"`,
    );

    // reminder_group.userTagId
    await queryRunner.query(
      `ALTER TABLE "reminder_group" RENAME COLUMN "userTagId" TO "userTagId_int"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminder_group" RENAME COLUMN "userTagId_uuid" TO "userTagId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminder_group" DROP COLUMN "userTagId_int"`,
    );

    // 6) Swap tag PK from int → uuid

    await queryRunner.query(
      `ALTER TABLE "tag" DROP CONSTRAINT "PK_8e4052373c579afc1471f526760"`,
    );
    await queryRunner.query(`ALTER TABLE "tag" RENAME COLUMN "id" TO "id_int"`);
    await queryRunner.query(
      `ALTER TABLE "tag" RENAME COLUMN "id_uuid" TO "id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag" ADD CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "id_int"`);

    // Optional: drop the temporary unique index (PK already enforces uniqueness)
    await queryRunner.query(`DROP INDEX "IDX_tag_id_uuid"`);

    // 7) Recreate FKs to point at tag(id UUID)

    await queryRunner.query(`
          ALTER TABLE "action_update"
          ADD CONSTRAINT "FK_de574ee379db67b585ac575549e"
          FOREIGN KEY ("tagId") REFERENCES "tag"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
          ALTER TABLE "reminder_group"
          ADD CONSTRAINT "FK_dbb157db646be57f5e14f7deedf"
          FOREIGN KEY ("userTagId") REFERENCES "tag"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
          ALTER TABLE "tag_users_user"
          ADD CONSTRAINT "FK_ac2dc02851d77738e7aba2782fe"
          FOREIGN KEY ("tagId") REFERENCES "tag"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
        `);

    await queryRunner.query(`
          ALTER TABLE "tag_participating_in_action"
          ADD CONSTRAINT "FK_b0a20bd6ef1b97861a20e194b99"
          FOREIGN KEY ("tagId") REFERENCES "tag"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
        `);

    await queryRunner.query(`
          ALTER TABLE "action_participating_tags_tag"
          ADD CONSTRAINT "FK_488f25c6897226813db2de109eb"
          FOREIGN KEY ("tagId") REFERENCES "tag"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(): Promise<void> {}
}
