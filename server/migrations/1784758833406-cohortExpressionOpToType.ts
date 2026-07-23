import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cohort expressions become a single discriminated union on `type`: boolean
 * operator nodes `{"op": "AND" | "OR" | "NOT"}` are renamed to
 * `{"type": ...}`. Leaf conditions already use `type` and pass through
 * unchanged. The rewrite recurses only through operator children, mirroring
 * the shape in common/src/cohort-expression.ts.
 */
export class CohortExpressionOpToType1784758833406 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // pg_temp so the helper dies with the session instead of lingering in
        // the schema. plpgsql (not sql) because the body is recursive, and sql
        // bodies are resolved at creation time.
        await queryRunner.query(`
            CREATE FUNCTION pg_temp.cohort_op_to_type(expr jsonb) RETURNS jsonb AS $$
            BEGIN
                IF jsonb_typeof(expr) <> 'object' THEN
                    RETURN expr;
                END IF;
                IF expr->>'op' IN ('AND', 'OR') THEN
                    RETURN jsonb_build_object(
                        'type', expr->>'op',
                        'children', coalesce(
                            (SELECT jsonb_agg(pg_temp.cohort_op_to_type(child))
                             FROM jsonb_array_elements(expr->'children') AS child),
                            '[]'::jsonb));
                ELSIF expr->>'op' = 'NOT' THEN
                    RETURN jsonb_build_object(
                        'type', 'NOT',
                        'child', pg_temp.cohort_op_to_type(expr->'child'));
                END IF;
                RETURN expr;
            END
            $$ LANGUAGE plpgsql
        `);
        await queryRunner.query(`
            UPDATE "action"
            SET "cohortExpression" = pg_temp.cohort_op_to_type("cohortExpression")
            WHERE "cohortExpression" IS NOT NULL
        `);
        await queryRunner.query(`
            UPDATE "follow_up_form"
            SET "cohortExpression" = pg_temp.cohort_op_to_type("cohortExpression")
            WHERE "cohortExpression" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE FUNCTION pg_temp.cohort_type_to_op(expr jsonb) RETURNS jsonb AS $$
            BEGIN
                IF jsonb_typeof(expr) <> 'object' THEN
                    RETURN expr;
                END IF;
                IF expr->>'type' IN ('AND', 'OR') THEN
                    RETURN jsonb_build_object(
                        'op', expr->>'type',
                        'children', coalesce(
                            (SELECT jsonb_agg(pg_temp.cohort_type_to_op(child))
                             FROM jsonb_array_elements(expr->'children') AS child),
                            '[]'::jsonb));
                ELSIF expr->>'type' = 'NOT' THEN
                    RETURN jsonb_build_object(
                        'op', 'NOT',
                        'child', pg_temp.cohort_type_to_op(expr->'child'));
                END IF;
                RETURN expr;
            END
            $$ LANGUAGE plpgsql
        `);
        await queryRunner.query(`
            UPDATE "action"
            SET "cohortExpression" = pg_temp.cohort_type_to_op("cohortExpression")
            WHERE "cohortExpression" IS NOT NULL
        `);
        await queryRunner.query(`
            UPDATE "follow_up_form"
            SET "cohortExpression" = pg_temp.cohort_type_to_op("cohortExpression")
            WHERE "cohortExpression" IS NOT NULL
        `);
    }

}
