import { MigrationInterface, QueryRunner } from "typeorm";

type Expression = Record<string, unknown>;

type HandBuiltArm = {
  actionId: number;
  /** md5 of the action's `cohortExpression::text` in staging on 2026-11-09. */
  expressionMd5: string;
  optional: boolean;
  /** The action's current expression becomes its rule; the last arm has none. */
  catchAll: boolean;
};

type HandBuiltSplit = { suiteId: number; arms: HandBuiltArm[] };

const SPLITS: HandBuiltSplit[] = [
  {
    suiteId: 60,
    arms: [
      { actionId: 152, expressionMd5: "78f2c4ba6dfb6e2f9436c58a14878f79", optional: true, catchAll: false },
      { actionId: 149, expressionMd5: "00f97750b1fd35f294669e893da1bf49", optional: false, catchAll: true },
    ],
  },
  {
    suiteId: 64,
    arms: [
      { actionId: 158, expressionMd5: "6200d4caf261349469e20c3738ea1c53", optional: false, catchAll: false },
      { actionId: 157, expressionMd5: "f254d4fba6d66211a8fcd9a30c71067c", optional: false, catchAll: true },
    ],
  },
  {
    suiteId: 65,
    arms: [
      { actionId: 161, expressionMd5: "f962a1b0edb843da83286f01e805791a", optional: false, catchAll: false },
      { actionId: 160, expressionMd5: "3bd44216bd578038855bed1eda68b27d", optional: false, catchAll: true },
    ],
  },
  {
    suiteId: 66,
    arms: [
      { actionId: 162, expressionMd5: "6e256aec092ddc80f46ce9f125957ea5", optional: false, catchAll: false },
      { actionId: 164, expressionMd5: "c316ddd3e97afdf2fc3e245531cd710d", optional: false, catchAll: false },
      { actionId: 163, expressionMd5: "4710fc0a6f2877cbdf7eb466935c27b4", optional: false, catchAll: true },
    ],
  },
  {
    suiteId: 69,
    arms: [
      { actionId: 171, expressionMd5: "74c17b160a7da1a646f0fde84a3e1f95", optional: true, catchAll: false },
      { actionId: 169, expressionMd5: "943b877d1c6cd2835f9133a018f376e0", optional: false, catchAll: true },
    ],
  },
  {
    suiteId: 71,
    arms: [
      { actionId: 176, expressionMd5: "70a6609c746acb17d556d12a1c15d3ee", optional: true, catchAll: false },
      { actionId: 174, expressionMd5: "27633ccccfb1521144a70e01bae283df", optional: false, catchAll: true },
    ],
  },
];

type ActionRow = {
  id: number;
  suiteId: number | null;
  optional: boolean;
  md5: string;
  expression: Expression;
  start: string | null;
  deadline: string | null;
};

/** A frozen copy of `armRoutingExpressions` in `src/actions/suite-split.ts`. */
function routingExpression(rules: (Expression | null)[], index: number): Expression {
  const children = [
    ...rules.slice(0, index).flatMap((rule) => (rule ? [{ type: "NOT", child: rule }] : [])),
    ...(rules[index] ? [rules[index]] : []),
  ];
  return children.length === 1 ? children[0] : { type: "AND", children };
}

export class ConvertHandBuiltSuiteSplits1794275385336 implements MigrationInterface {
  name = "ConvertHandBuiltSuiteSplits1794275385336";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const ids = SPLITS.flatMap((split) => split.arms.map((arm) => arm.actionId));
    const rows: ActionRow[] = await queryRunner.query(
      `SELECT a."id", a."suiteId", a."optional", md5(a."cohortExpression"::text) AS "md5",
              a."cohortExpression" AS "expression", s."date" AS "start",
              (SELECT MIN(e."date") FROM "action_event" e
               WHERE e."actionId" = a."id" AND e."deletedAt" IS NULL AND e."date" > s."date") AS "deadline"
       FROM "action" a
       LEFT JOIN "action_event" s
         ON s."actionId" = a."id" AND s."deletedAt" IS NULL AND s."newStatus" = 'member_action'
       WHERE a."id" = ANY($1) AND a."deletedAt" IS NULL`,
      [ids],
    );
    // A database without this history, such as a fresh dev or test one.
    if (rows.length === 0) return;
    const byId = new Map(rows.map((row) => [row.id, row]));

    const problems = SPLITS.flatMap((split) =>
      split.arms.flatMap((arm) => {
        const row = byId.get(arm.actionId);
        if (!row) return [`action ${arm.actionId} is missing`];
        const first = byId.get(split.arms[0].actionId);
        return [
          row.suiteId !== split.suiteId && `action ${arm.actionId} is in suite ${row.suiteId}, not ${split.suiteId}`,
          row.md5 !== arm.expressionMd5 && `action ${arm.actionId}'s cohort expression changed`,
          row.optional !== arm.optional && `action ${arm.actionId}'s optional flag changed`,
          first &&
            (String(row.start) !== String(first.start) || String(row.deadline) !== String(first.deadline)) &&
            `action ${arm.actionId}'s schedule differs from action ${split.arms[0].actionId}'s`,
        ].filter((problem) => typeof problem === "string");
      }),
    );
    if (problems.length > 0) {
      throw new Error(`Hand-built splits differ from staging: ${problems.join("; ")}`);
    }

    for (const split of SPLITS) {
      const suite: { name: string }[] = await queryRunner.query(
        `SELECT "name" FROM "action_suite" WHERE "id" = $1`,
        [split.suiteId],
      );
      const [{ id: splitId }]: { id: number }[] = await queryRunner.query(
        `INSERT INTO "action_suite_split" ("suiteId", "title", "visibilityMode", "filterExpression")
         VALUES ($1, $2, 'per_arm', NULL) RETURNING "id"`,
        [split.suiteId, suite[0]?.name ?? `Suite ${split.suiteId}`],
      );
      const rules = split.arms.map((arm) => (arm.catchAll ? null : byId.get(arm.actionId)!.expression));
      for (const [position, arm] of split.arms.entries()) {
        await queryRunner.query(
          `INSERT INTO "action_suite_split_arm" ("splitId", "actionId", "position", "rule", "optional")
           VALUES ($1, $2, $3, $4, $5)`,
          [splitId, arm.actionId, position, rules[position] && JSON.stringify(rules[position]), arm.optional],
        );
        await queryRunner.query(
          `UPDATE "action" SET "optional" = false, "cohortExpression" = $2 WHERE "id" = $1`,
          [arm.actionId, JSON.stringify(routingExpression(rules, position))],
        );
      }

      const off: { userId: number; included: number }[] = await queryRunner.query(
        `SELECT d."userId", COUNT(*) FILTER (WHERE d."included")::int AS "included"
         FROM "action_cohort_decision" d
         WHERE d."actionId" = ANY($1) AND d."deletedAt" IS NULL
         GROUP BY d."userId"
         HAVING COUNT(*) FILTER (WHERE d."included") <> 1`,
        [split.arms.map((arm) => arm.actionId)],
      );
      for (const count of new Set(off.map((row) => row.included))) {
        const userIds = off.filter((row) => row.included === count).map((row) => row.userId);
        console.log(
          `suite ${split.suiteId}: ${userIds.length} member(s) hold ${count} included arms: ${userIds.join(", ")}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error("Restore the arms' expressions and optional flags from a backup; this conversion keeps no copy.");
  }
}
