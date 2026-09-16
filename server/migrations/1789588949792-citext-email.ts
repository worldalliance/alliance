import { MigrationInterface, QueryRunner } from "typeorm";

export class CitextEmail1789588949792 implements MigrationInterface {
    name = 'CitextEmail1789588949792'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const collisions: { accounts: string }[] = await queryRunner.query(`SELECT string_agg(id || ' ' || to_json(email)::text, ', ' ORDER BY id) AS accounts FROM "user" GROUP BY lower(email) HAVING count(*) > 1`);
        if (collisions.length > 0) {
            throw new Error(`Accounts whose emails differ only in case; resolve them, then re-run:\n${collisions.map(({ accounts }) => accounts).join("\n")}`);
        }
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" TYPE citext`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" TYPE character varying`);
    }

}
