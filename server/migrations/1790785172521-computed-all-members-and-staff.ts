import { MigrationInterface, QueryRunner } from "typeorm";
import {
    rewriteComputedLeavesToTags,
    rewriteTagLeavesToComputed,
} from "./lib/computed-tag-leaves";

export class ComputedAllMembersAndStaff1790785172521 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await rewriteTagLeavesToComputed(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await rewriteComputedLeavesToTags(queryRunner);
    }

}
