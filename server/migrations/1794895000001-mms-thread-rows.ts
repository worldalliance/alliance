import { MigrationInterface, QueryRunner } from "typeorm";

export class MmsThreadRows1794895000001 implements MigrationInterface {
    name = 'MmsThreadRows1794895000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO "mms_thread" ("phoneNumber") SELECT DISTINCT "memberPhoneNumber" FROM "mms" WHERE "direction" = 'inbound' OR "sentById" IS NOT NULL ON CONFLICT ("phoneNumber") DO NOTHING`);
    }

    public async down(): Promise<void> {}

}
