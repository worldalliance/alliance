import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDrift1758415133449 implements MigrationInterface {
    name = 'FixDrift1758415133449'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP CONSTRAINT "FK_action_activity_editable_content"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_post_editable_content"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_comment_editable_content"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "attachments"`);
        await queryRunner.query(`ALTER TABLE "editable_content" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "editable_content" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "editable_content" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "editable_content" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD CONSTRAINT "UQ_dadaa998b72ef0cf43d636f5688" UNIQUE ("editableContentId")`);
        await queryRunner.query(`ALTER TABLE "post" ALTER COLUMN "editableContentId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "UQ_05e0157b1ef173459241c190d89" UNIQUE ("editableContentId")`);
        await queryRunner.query(`ALTER TABLE "comment" ALTER COLUMN "editableContentId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "UQ_1bffff3c7014b70ee0bdb1cc839" UNIQUE ("editableContentId")`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD CONSTRAINT "FK_dadaa998b72ef0cf43d636f5688" FOREIGN KEY ("editableContentId") REFERENCES "editable_content"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_05e0157b1ef173459241c190d89" FOREIGN KEY ("editableContentId") REFERENCES "editable_content"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_1bffff3c7014b70ee0bdb1cc839" FOREIGN KEY ("editableContentId") REFERENCES "editable_content"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_1bffff3c7014b70ee0bdb1cc839"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_05e0157b1ef173459241c190d89"`);
        await queryRunner.query(`ALTER TABLE "action_activity" DROP CONSTRAINT "FK_dadaa998b72ef0cf43d636f5688"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "UQ_1bffff3c7014b70ee0bdb1cc839"`);
        await queryRunner.query(`ALTER TABLE "comment" ALTER COLUMN "editableContentId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "UQ_05e0157b1ef173459241c190d89"`);
        await queryRunner.query(`ALTER TABLE "post" ALTER COLUMN "editableContentId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action_activity" DROP CONSTRAINT "UQ_dadaa998b72ef0cf43d636f5688"`);
        await queryRunner.query(`ALTER TABLE "editable_content" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "editable_content" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "editable_content" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "editable_content" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "comment" ADD "attachments" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_comment_editable_content" FOREIGN KEY ("editableContentId") REFERENCES "editable_content"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_post_editable_content" FOREIGN KEY ("editableContentId") REFERENCES "editable_content"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD CONSTRAINT "FK_action_activity_editable_content" FOREIGN KEY ("editableContentId") REFERENCES "editable_content"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
