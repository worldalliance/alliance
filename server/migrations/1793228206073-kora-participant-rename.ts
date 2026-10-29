import { MigrationInterface, QueryRunner } from "typeorm";

const TABLES: [string, string][] = [
    ["project_participant", "kora_participant"],
    ["project_participant_signup", "kora_participant_signup"],
    ["project_participant_session", "kora_participant_session"],
];

const CONSTRAINTS: [string, string, string][] = [
    ["kora_participant", "PK_149de99a476203f813c3cb43a09", "PK_4d3e95d93bd77c3a4f77425698b"],
    ["kora_participant", "CHK_project_participant_name_not_blank", "CHK_kora_participant_name_not_blank"],
    ["kora_participant", "CHK_project_participant_phone_e164", "CHK_kora_participant_phone_e164"],
    ["kora_participant", "CHK_project_participant_one_contact", "CHK_kora_participant_one_contact"],
    ["kora_participant_signup", "PK_df5c7c89628cac73789cc0614b2", "PK_c4e4dafd7393bdcd25df8181e93"],
    ["kora_participant_session", "PK_ba5f9ac4c74494a22cec557d2f6", "PK_37a64135331c5303cebc69f4c21"],
    ["kora_participant_session", "FK_ccebbd78931744eee151caa4673", "FK_9b841e3fafed8e32e8bf2f5341e"],
];

const INDEXES: [string, string][] = [
    ["IDX_98c30a7d285ab1ebaaa528a9ff", "IDX_58e1b00709eafb97213e98a89e"],
    ["IDX_dfec63cf438e6ddcd17095769a", "IDX_a3521224fec5459125ed0a8265"],
    ["IDX_c1edb5c3499d9464db56ad31a8", "IDX_994e45f6fce47439ee51a8d5da"],
    ["IDX_ccebbd78931744eee151caa467", "IDX_9b841e3fafed8e32e8bf2f5341"],
    ["IDX_44a9f6eb18868ff658c76ffaa5", "IDX_01d35f07e1ab5fcdc0609e99b2"],
];

export class KoraParticipantRename1793228206073 implements MigrationInterface {
    name = 'KoraParticipantRename1793228206073'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const [from, to] of TABLES) {
            await queryRunner.query(`ALTER TABLE "${from}" RENAME TO "${to}"`);
        }
        for (const [table, from, to] of CONSTRAINTS) {
            await queryRunner.query(`ALTER TABLE "${table}" RENAME CONSTRAINT "${from}" TO "${to}"`);
        }
        for (const [from, to] of INDEXES) {
            await queryRunner.query(`ALTER INDEX "public"."${from}" RENAME TO "${to}"`);
        }
        await queryRunner.query(`ALTER TYPE "public"."OtpPurpose" RENAME VALUE 'participant_sign_in' TO 'kora_sign_in'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."OtpPurpose" RENAME VALUE 'kora_sign_in' TO 'participant_sign_in'`);
        for (const [from, to] of INDEXES) {
            await queryRunner.query(`ALTER INDEX "public"."${to}" RENAME TO "${from}"`);
        }
        for (const [table, from, to] of CONSTRAINTS) {
            await queryRunner.query(`ALTER TABLE "${table}" RENAME CONSTRAINT "${to}" TO "${from}"`);
        }
        for (const [from, to] of TABLES) {
            await queryRunner.query(`ALTER TABLE "${to}" RENAME TO "${from}"`);
        }
    }
}
