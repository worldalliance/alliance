import { MigrationInterface, QueryRunner } from "typeorm";

const noManualUsers = {
    type: "NOT",
    child: { type: "Manual", userIds: [154, 111] },
};
const answeredForm73 = {
    type: "FormFieldValue",
    formId: 73,
    fieldId: "field-1772761406418",
    responseAny: true,
};
const notAnswered0OnForm78 = {
    type: "NOT",
    child: {
        type: "FormFieldValue",
        formId: 78,
        fieldId: "field-1773967697614",
        responseEqualTo: "0",
    },
};
const notAnsweredYesOnForm126 = {
    type: "NOT",
    child: {
        type: "FormFieldValue",
        formId: 126,
        fieldId: "field-1784076209430",
        responseEqualTo: "Yes",
    },
};

// Each upstream action has left member action, so its InProgressAction leaf
// is false for everyone and dropping it leaves the cohort unchanged.
const conversions = [
    {
        actionId: 81,
        prerequisiteActionId: 80,
        before: {
            type: "AND",
            children: [
                noManualUsers,
                {
                    type: "OR",
                    children: [
                        { type: "InProgressAction", actionId: 80 },
                        answeredForm73,
                    ],
                },
            ],
        },
        after: { type: "AND", children: [noManualUsers, answeredForm73] },
    },
    {
        actionId: 83,
        prerequisiteActionId: 80,
        before: {
            type: "NOT",
            child: {
                type: "AND",
                children: [
                    noManualUsers,
                    {
                        type: "OR",
                        children: [
                            { type: "InProgressAction", actionId: 80 },
                            answeredForm73,
                        ],
                    },
                ],
            },
        },
        after: {
            type: "NOT",
            child: { type: "AND", children: [noManualUsers, answeredForm73] },
        },
    },
    {
        actionId: 87,
        prerequisiteActionId: 84,
        before: {
            type: "AND",
            children: [
                notAnswered0OnForm78,
                {
                    type: "OR",
                    children: [
                        { type: "CompletedAction", actionId: 84 },
                        { type: "InProgressAction", actionId: 84 },
                    ],
                },
            ],
        },
        after: {
            type: "AND",
            children: [
                notAnswered0OnForm78,
                { type: "CompletedAction", actionId: 84 },
            ],
        },
    },
    {
        actionId: 128,
        prerequisiteActionId: 126,
        before: {
            type: "OR",
            children: [
                { type: "CompletedAction", actionId: 126 },
                { type: "InProgressAction", actionId: 126 },
            ],
        },
        after: { type: "CompletedAction", actionId: 126 },
    },
    {
        actionId: 142,
        prerequisiteActionId: 141,
        before: {
            type: "OR",
            children: [
                {
                    type: "AND",
                    children: [
                        notAnsweredYesOnForm126,
                        {
                            type: "NOT",
                            child: { type: "InProgressAction", actionId: 141 },
                        },
                    ],
                },
                { type: "MissedActionDeadline", actionId: 141 },
            ],
        },
        after: {
            type: "OR",
            children: [
                notAnsweredYesOnForm126,
                { type: "MissedActionDeadline", actionId: 141 },
            ],
        },
    },
];

export class InProgressActionToPrerequisites1790637870855 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { actionId, prerequisiteActionId, before, after } of conversions) {
            await queryRunner.query(
                `UPDATE "action"
                 SET "cohortExpression" = $2::jsonb, "prerequisiteActionIds" = ARRAY[$3::integer]
                 WHERE "id" = $1 AND "cohortExpression" = $4::jsonb AND "prerequisiteActionIds" = '{}'`,
                [actionId, JSON.stringify(after), prerequisiteActionId, JSON.stringify(before)],
            );
        }
        const remaining: Array<{ source: string; id: number }> = await queryRunner.query(`
            SELECT 'action' AS "source", "id" FROM "action"
            WHERE "cohortExpression"::text LIKE '%"InProgressAction"%'
            UNION ALL
            SELECT 'follow_up_form', "id" FROM "follow_up_form"
            WHERE "cohortExpression"::text LIKE '%"InProgressAction"%'
        `);
        if (remaining.length > 0) {
            throw new Error(
                `InProgressAction leaves remain after the conversions, which skip an action whose expression or prerequisites differ from the expected ones: ${remaining
                    .map(({ source, id }) => `${source} ${id}`)
                    .join(", ")}`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { actionId, prerequisiteActionId, before, after } of conversions) {
            await queryRunner.query(
                `UPDATE "action"
                 SET "cohortExpression" = $2::jsonb, "prerequisiteActionIds" = '{}'
                 WHERE "id" = $1 AND "cohortExpression" = $3::jsonb AND "prerequisiteActionIds" = ARRAY[$4::integer]`,
                [actionId, JSON.stringify(before), JSON.stringify(after), prerequisiteActionId],
            );
        }
    }

}
