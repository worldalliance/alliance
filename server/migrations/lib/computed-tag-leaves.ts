// Frozen helpers for `1790785172521-ComputedAllMembersAndStaff`. They live
// outside `migrations/*.ts` because TypeORM instantiates every export it finds
// there. Application code must not import them, and their behavior must not
// change once the migration has run.
import { QueryRunner } from "typeorm";

type Node = { type: string; tagId?: string; child?: Node; children?: Node[] };

const TABLES = ["action", "follow_up_form"] as const;
const LEAF_TYPE_BY_TAG_NAME = { "All Members": "AllMembers", Staff: "Staff" };

function rewrite(node: Node, replace: (leaf: Node) => Node): Node {
    if (node.children) {
        return { ...node, children: node.children.map((child) => rewrite(child, replace)) };
    }
    if (node.child) {
        return { ...node, child: rewrite(node.child, replace) };
    }
    return replace(node);
}

async function loadTagIds(queryRunner: QueryRunner): Promise<Map<string, string>> {
    const rows: Array<{ id: string; name: string }> = await queryRunner.query(
        `SELECT "id", "name" FROM "tag" WHERE "name" = ANY($1)`,
        [Object.keys(LEAF_TYPE_BY_TAG_NAME)],
    );
    return new Map(rows.map(({ id, name }) => [name, id]));
}

async function rewriteExpressions(
    queryRunner: QueryRunner,
    replace: (leaf: Node) => Node,
): Promise<void> {
    for (const table of TABLES) {
        const rows: Array<{ id: number; cohortExpression: Node }> = await queryRunner.query(
            `SELECT "id", "cohortExpression" FROM "${table}" WHERE "cohortExpression" IS NOT NULL`,
        );
        for (const { id, cohortExpression } of rows) {
            const rewritten = JSON.stringify(rewrite(cohortExpression, replace));
            if (rewritten !== JSON.stringify(cohortExpression)) {
                await queryRunner.query(
                    `UPDATE "${table}" SET "cohortExpression" = $2::jsonb WHERE "id" = $1`,
                    [id, rewritten],
                );
            }
        }
    }
}

export async function rewriteTagLeavesToComputed(queryRunner: QueryRunner): Promise<void> {
    const tagIds = await loadTagIds(queryRunner);
    const leafTypeByTagId = new Map(
        Object.entries(LEAF_TYPE_BY_TAG_NAME).map(([name, type]) => [tagIds.get(name), type]),
    );
    await rewriteExpressions(queryRunner, (leaf) => {
        const type = leaf.type === "Tag" && leafTypeByTagId.get(leaf.tagId);
        return type ? { type } : leaf;
    });
}

export async function rewriteComputedLeavesToTags(queryRunner: QueryRunner): Promise<void> {
    const tagIds = await loadTagIds(queryRunner);
    const tagIdByLeafType = new Map(
        Object.entries(LEAF_TYPE_BY_TAG_NAME).map(([name, type]) => [type, tagIds.get(name)]),
    );
    await rewriteExpressions(queryRunner, (leaf) => {
        const tagId = tagIdByLeafType.get(leaf.type);
        return tagId ? { type: "Tag", tagId } : leaf;
    });
}
