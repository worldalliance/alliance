import { MigrationInterface, QueryRunner } from "typeorm";

export class BlankProfilePictureToNull1785869101541 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "user" SET "profilePicture" = NULL WHERE TRIM("profilePicture") = ''`);
    }

    public async down(): Promise<void> {
        // Blank already meant the same thing as NULL to every reader, so there
        // is nothing to restore and no way to tell the collapsed rows apart.
    }

}
