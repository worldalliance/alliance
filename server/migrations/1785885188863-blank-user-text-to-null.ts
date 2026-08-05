import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * These columns stay `nullable: true`, so there is no schema change for
 * `migration:generate` to find — only the data needs collapsing. Their entities
 * now spell absence as NULL, and a blank string is a second spelling of it that
 * every reader already treated the same way.
 */
export class BlankUserTextToNull1785885188863 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "user" SET "profilePicture" = NULL WHERE TRIM("profilePicture") = ''`);
        await queryRunner.query(`UPDATE "user" SET "profileDescription" = NULL WHERE TRIM("profileDescription") = ''`);
        await queryRunner.query(`UPDATE "user" SET "customCityString" = NULL WHERE TRIM("customCityString") = ''`);
    }

    public async down(): Promise<void> {
        // Blank already meant the same thing as NULL to every reader, so there
        // is nothing to restore and no way to tell the collapsed rows apart.
    }

}
