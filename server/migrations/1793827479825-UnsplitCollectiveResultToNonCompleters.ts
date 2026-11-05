import { MigrationInterface, QueryRunner } from "typeorm";

export class UnsplitCollectiveResultToNonCompleters1793827479825 implements MigrationInterface {
    name = 'UnsplitCollectiveResultToNonCompleters1793827479825'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "action_update" SET "nonCompleterResult" = NULLIF("shortNotifString", ''), "uninvolvedResult" = NULLIF("shortNotifString", ''), "splitCollectiveResult" = true WHERE NOT "splitCollectiveResult" AND "notificationMode" <> 'legacy'`);
    }

    // Every group's text now equals the old collective result, so a server that reads
    // splitCollectiveResult and one that ignores it both send what the unsplit row did.
    public async down(): Promise<void> {}

}
