import { MigrationInterface, QueryRunner } from "typeorm";

export class Contractcascading1765219590830 implements MigrationInterface {
    name = 'Contractcascading1765219590830'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_event" DROP CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976"`);
        await queryRunner.query(`ALTER TABLE "contract_event" ADD CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_event" DROP CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976"`);
        await queryRunner.query(`ALTER TABLE "contract_event" ADD CONSTRAINT "FK_a37c8efb594c7e19c7151fb2976" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
