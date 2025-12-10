import { MigrationInterface, QueryRunner } from 'typeorm';

export class SwitchIsvalidToStatus1765408390983 implements MigrationInterface {
  name = 'SwitchIsvalidToStatus1765408390983';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rename old column
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" RENAME COLUMN "isValid" TO "isValid_old"`,
    );

    // 2. Create enum
    await queryRunner.query(
      `CREATE TYPE "public"."onetime_invite_status_enum" AS ENUM('link_unused', 'link_used')`,
    );

    // 3. Add new enum column (nullable for now)
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" ADD "status" "public"."onetime_invite_status_enum"`,
    );

    // 4. Migrate boolean values into enum (CAST to enum!)
    await queryRunner.query(`
            UPDATE "onetime_invite"
            SET "status" = CASE 
                WHEN "isValid_old" = true  THEN 'link_unused'::"public"."onetime_invite_status_enum"
                WHEN "isValid_old" = false THEN 'link_used'::"public"."onetime_invite_status_enum"
            END
        `);

    // 5. Make status NOT NULL
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" ALTER COLUMN "status" SET NOT NULL`,
    );

    // 6. Drop the old column
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" DROP COLUMN "isValid_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Add back old boolean column (nullable temporarily)
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" ADD "isValid_old" boolean`,
    );

    // 2. Convert enum back to boolean
    await queryRunner.query(`
            UPDATE "onetime_invite"
            SET "isValid_old" = CASE
                WHEN "status" = 'link_unused' THEN true
                WHEN "status" = 'link_used'   THEN false
            END
        `);

    // 3. Drop new column + enum
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" DROP COLUMN "status"`,
    );
    await queryRunner.query(`DROP TYPE "public"."onetime_invite_status_enum"`);

    // 4. Rename back
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" RENAME COLUMN "isValid_old" TO "isValid"`,
    );

    // 5. Restore NOT NULL + default
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" ALTER COLUMN "isValid" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "onetime_invite" ALTER COLUMN "isValid" SET DEFAULT true`,
    );
  }
}
