import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractEvents1765216053240 implements MigrationInterface {
  name = 'ContractEvents1765216053240';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum + table
    await queryRunner.query(
      `CREATE TYPE "public"."contract_event_type_enum" AS ENUM('signed', 'suspended')`,
    );

    await queryRunner.query(
      `CREATE TABLE "contract_event" (
            "id" SERIAL NOT NULL,
            "type" "public"."contract_event_type_enum" NOT NULL,
            "date" TIMESTAMP WITH TIME ZONE NOT NULL,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "automatic" boolean NOT NULL DEFAULT false,
            "userId" integer,
            CONSTRAINT "PK_a0a0fdb2918e838e546c3b5fd01" PRIMARY KEY ("id")
          )`,
    );

    await queryRunner.query(
      `ALTER TABLE "contract_event"
           ADD CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976"
           FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
          INSERT INTO "contract_event" ("type", "date", "automatic", "userId")
          SELECT
            'signed'::"public"."contract_event_type_enum" AS "type",
            "contractDateSigned" AS "date",
            FALSE AS "automatic",
            "id" AS "userId"
          FROM "user"
          WHERE "contractDateSigned" IS NOT NULL
        `);

    // Suspended events
    await queryRunner.query(`
          INSERT INTO "contract_event" ("type", "date", "automatic", "userId")
          SELECT
            'suspended'::"public"."contract_event_type_enum" AS "type",
            "contractDateSuspended" AS "date",
            FALSE AS "automatic",
            "id" AS "userId"
          FROM "user"
          WHERE "contractDateSuspended" IS NOT NULL
        `);

    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "contractDateSigned"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "contractDateSuspended"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_away_range" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_away_range" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_away_range" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract_event" DROP CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_away_range" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_away_range" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_away_range" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "contractDateSuspended" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "contractDateSigned" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`DROP TABLE "contract_event"`);
    await queryRunner.query(`DROP TYPE "public"."contract_event_type_enum"`);
  }
}
