import { MigrationInterface, QueryRunner } from "typeorm";

export class SuitePartitions1795536210552 implements MigrationInterface {
    name = 'SuitePartitions1795536210552'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "suite_split" RENAME TO "suite_partition"`);
        await queryRunner.query(`ALTER TABLE "suite_partition" RENAME CONSTRAINT "PK_15a31b78d0f8f72c10726bf9e9c" TO "PK_cdb4b8a161588fcdfe21d5fb377"`);
        await queryRunner.query(`ALTER TABLE "suite_partition" RENAME CONSTRAINT "FK_15a31b78d0f8f72c10726bf9e9c" TO "FK_cdb4b8a161588fcdfe21d5fb377"`);
        await queryRunner.query(`ALTER TABLE "suite_partition" RENAME CONSTRAINT "FK_29c5ff6f6704b9a394974e20b42" TO "FK_d1642c936da3e3a26bf485d2f32"`);

        await queryRunner.query(`ALTER TABLE "suite_split_version" RENAME TO "suite_partition_version"`);
        await queryRunner.query(`ALTER SEQUENCE "suite_split_version_id_seq" RENAME TO "suite_partition_version_id_seq"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME COLUMN "groups" TO "parts"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME CONSTRAINT "PK_12df340fa1146f982248230ab91" TO "PK_542c9a55802afcaedd7cabb06f2"`);
        await queryRunner.query(`ALTER INDEX "IDX_1703a3f677e3f223d4cb96ab45" RENAME TO "IDX_e143cb19eacfc13f53f9d99ae5"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME CONSTRAINT "FK_1703a3f677e3f223d4cb96ab457" TO "FK_e143cb19eacfc13f53f9d99ae5d"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME CONSTRAINT "FK_89bc5a757d1053b3d65b4bba1de" TO "FK_0efa03baff2a2cc4a83692337b6"`);

        await queryRunner.query(`ALTER TABLE "suite_split_pin" RENAME TO "suite_partition_pin"`);
        await queryRunner.query(`ALTER SEQUENCE "suite_split_pin_id_seq" RENAME TO "suite_partition_pin_id_seq"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME COLUMN "splitVersionId" TO "partitionVersionId"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME CONSTRAINT "PK_b2bd160c4490b484f7f5944a2ae" TO "PK_89d4ca3df5a3a5fd778318222c5"`);
        await queryRunner.query(`ALTER INDEX "IDX_b04b0bd267e726022206b7dcdc" RENAME TO "IDX_56b91dde4f96fbdee0de6dcc45"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME CONSTRAINT "FK_b04b0bd267e726022206b7dcdc0" TO "FK_56b91dde4f96fbdee0de6dcc45c"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME CONSTRAINT "FK_5cdcff4785526a3c91c59fa47d5" TO "FK_f543ebcb26cd544e36f789f5464"`);

        await queryRunner.query(`ALTER TABLE "suite_split_placement" RENAME TO "suite_partition_placement"`);
        await queryRunner.query(`ALTER SEQUENCE "suite_split_placement_id_seq" RENAME TO "suite_partition_placement_id_seq"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME COLUMN "groupId" TO "partId"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "PK_6743cee9cbfba915ddbcbbc672f" TO "PK_7e0212cdef2129598b3cdafe158"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "UQ_suite_split_placement_suiteId_userId" TO "UQ_suite_partition_placement_suiteId_userId"`);
        await queryRunner.query(`ALTER INDEX "IDX_suite_split_placement_userId" RENAME TO "IDX_suite_partition_placement_userId"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "FK_5866489a489ceefc13da192c802" TO "FK_da0f4ed5823c37f05a88b3b000b"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "FK_4b936e5f8d780f9e328cd62a294" TO "FK_e3662d3e8288c77dc6af2f1ecd9"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "FK_3267817c6488d523c822c45a865" TO "FK_f6f862d55bf30486ffce80dcaef"`);
        await queryRunner.query(`UPDATE "suite_partition_placement" SET "trace" = jsonb_set("trace", '{steps}', (SELECT COALESCE(jsonb_agg((step - 'groupId') || jsonb_build_object('partId', step->'groupId') ORDER BY ordinality), '[]'::jsonb) FROM jsonb_array_elements("trace"->'steps') WITH ORDINALITY AS steps(step, ordinality)))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "suite_partition_placement" SET "trace" = jsonb_set("trace", '{steps}', (SELECT COALESCE(jsonb_agg((step - 'partId') || jsonb_build_object('groupId', step->'partId') ORDER BY ordinality), '[]'::jsonb) FROM jsonb_array_elements("trace"->'steps') WITH ORDINALITY AS steps(step, ordinality)))`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "FK_f6f862d55bf30486ffce80dcaef" TO "FK_3267817c6488d523c822c45a865"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "FK_e3662d3e8288c77dc6af2f1ecd9" TO "FK_4b936e5f8d780f9e328cd62a294"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "FK_da0f4ed5823c37f05a88b3b000b" TO "FK_5866489a489ceefc13da192c802"`);
        await queryRunner.query(`ALTER INDEX "IDX_suite_partition_placement_userId" RENAME TO "IDX_suite_split_placement_userId"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "UQ_suite_partition_placement_suiteId_userId" TO "UQ_suite_split_placement_suiteId_userId"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME CONSTRAINT "PK_7e0212cdef2129598b3cdafe158" TO "PK_6743cee9cbfba915ddbcbbc672f"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME COLUMN "partId" TO "groupId"`);
        await queryRunner.query(`ALTER SEQUENCE "suite_partition_placement_id_seq" RENAME TO "suite_split_placement_id_seq"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_placement" RENAME TO "suite_split_placement"`);

        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME CONSTRAINT "FK_f543ebcb26cd544e36f789f5464" TO "FK_5cdcff4785526a3c91c59fa47d5"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME CONSTRAINT "FK_56b91dde4f96fbdee0de6dcc45c" TO "FK_b04b0bd267e726022206b7dcdc0"`);
        await queryRunner.query(`ALTER INDEX "IDX_56b91dde4f96fbdee0de6dcc45" RENAME TO "IDX_b04b0bd267e726022206b7dcdc"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME CONSTRAINT "PK_89d4ca3df5a3a5fd778318222c5" TO "PK_b2bd160c4490b484f7f5944a2ae"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME COLUMN "partitionVersionId" TO "splitVersionId"`);
        await queryRunner.query(`ALTER SEQUENCE "suite_partition_pin_id_seq" RENAME TO "suite_split_pin_id_seq"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_pin" RENAME TO "suite_split_pin"`);

        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME CONSTRAINT "FK_0efa03baff2a2cc4a83692337b6" TO "FK_89bc5a757d1053b3d65b4bba1de"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME CONSTRAINT "FK_e143cb19eacfc13f53f9d99ae5d" TO "FK_1703a3f677e3f223d4cb96ab457"`);
        await queryRunner.query(`ALTER INDEX "IDX_e143cb19eacfc13f53f9d99ae5" RENAME TO "IDX_1703a3f677e3f223d4cb96ab45"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME CONSTRAINT "PK_542c9a55802afcaedd7cabb06f2" TO "PK_12df340fa1146f982248230ab91"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME COLUMN "parts" TO "groups"`);
        await queryRunner.query(`ALTER SEQUENCE "suite_partition_version_id_seq" RENAME TO "suite_split_version_id_seq"`);
        await queryRunner.query(`ALTER TABLE "suite_partition_version" RENAME TO "suite_split_version"`);

        await queryRunner.query(`ALTER TABLE "suite_partition" RENAME CONSTRAINT "FK_d1642c936da3e3a26bf485d2f32" TO "FK_29c5ff6f6704b9a394974e20b42"`);
        await queryRunner.query(`ALTER TABLE "suite_partition" RENAME CONSTRAINT "FK_cdb4b8a161588fcdfe21d5fb377" TO "FK_15a31b78d0f8f72c10726bf9e9c"`);
        await queryRunner.query(`ALTER TABLE "suite_partition" RENAME CONSTRAINT "PK_cdb4b8a161588fcdfe21d5fb377" TO "PK_15a31b78d0f8f72c10726bf9e9c"`);
        await queryRunner.query(`ALTER TABLE "suite_partition" RENAME TO "suite_split"`);
    }

}
