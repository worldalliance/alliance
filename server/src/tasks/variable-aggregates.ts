import { ActionActivityType } from "@alliance/common/actionActivity";
import { storedQuestionFields } from "@alliance/common/forms/stored-schema";
import {
  aggregateSourceKey,
  type VariableAggregateCounts,
  type VariableAggregateSource,
} from "@alliance/common/forms/variable-aggregates";
import { groupBy } from "es-toolkit";
import { In, type EntityManager } from "typeorm";
import { Form } from "./entities/form.entity";
import { formSchemaOf } from "./form-snapshot-schema";

export type VariableAggregate = VariableAggregateSource & {
  /** `null` when the form is gone or no longer has that multiselect. */
  counts: VariableAggregateCounts | null;
};

type CountRow = { fieldId: string; value: string; count: number };

/**
 * Per member, only the latest submission to the form that isn't a withdrawal
 * counts, and an option repeated within one answer counts once. Guests have
 * no user and don't count.
 */
function countLatestAnswers(params: {
  em: EntityManager;
  formId: number;
  fieldIds: string[];
}): Promise<CountRow[]> {
  return params.em.query(
    `WITH latest AS (
       SELECT DISTINCT ON (r."userId") r.answers
       FROM form_response r
       WHERE r."formId" = $1
         AND r."userId" IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM action_activity a
           WHERE a."taskFormResponseId" = r.id AND a.type = $3
         )
       ORDER BY r."userId", r."createdAt" DESC, r.id DESC
     )
     SELECT f.field_id AS "fieldId", v.value, count(*)::int AS count
     FROM latest
     CROSS JOIN unnest($2::text[]) AS f(field_id)
     CROSS JOIN LATERAL (
       SELECT DISTINCT value
       FROM jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(latest.answers -> f.field_id) = 'array'
           THEN latest.answers -> f.field_id
           ELSE '[]'::jsonb
         END
       ) AS value
     ) v
     GROUP BY f.field_id, v.value`,
    [params.formId, params.fieldIds, ActionActivityType.USER_WONT_COMPLETE],
  );
}

/**
 * Counts every configured option of each source's multiselect, zeros
 * included, from each form's current version. Sources on one form share one
 * query.
 */
export async function countVariableAggregates(params: {
  em: EntityManager;
  sources: readonly VariableAggregateSource[];
}): Promise<VariableAggregate[]> {
  const { em, sources } = params;
  const byForm = groupBy(sources, (source) => source.sourceFormId);
  const forms = await em.find(Form, {
    where: { id: In(Object.keys(byForm).map(Number)) },
    relations: { formSnapshot: true },
  });
  const optionsByKey = new Map<string, string[]>();
  for (const form of forms) {
    const fields = storedQuestionFields(formSchemaOf(form.formSnapshot));
    if (!fields.ok) continue;
    for (const field of fields.value) {
      if (field.kind === "multiselect") {
        optionsByKey.set(
          aggregateSourceKey({ sourceFormId: form.id, fieldId: field.id }),
          field.options.map((option) => option.value),
        );
      }
    }
  }
  const countable = Object.entries(byForm).flatMap(([formId, formSources]) => {
    const fieldIds = [
      ...new Set(
        formSources
          .filter((source) => optionsByKey.has(aggregateSourceKey(source)))
          .map((source) => source.fieldId),
      ),
    ];
    return fieldIds.length > 0 ? [{ formId: Number(formId), fieldIds }] : [];
  });
  const rows = (
    await Promise.all(
      countable.map(async ({ formId, fieldIds }) =>
        (await countLatestAnswers({ em, formId, fieldIds })).map((row) => ({
          ...row,
          formId,
        })),
      ),
    )
  ).flat();

  const counted = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = aggregateSourceKey({
      sourceFormId: row.formId,
      fieldId: row.fieldId,
    });
    const byValue = counted.get(key) ?? new Map<string, number>();
    byValue.set(row.value, row.count);
    counted.set(key, byValue);
  }
  return sources.map((source) => {
    const key = aggregateSourceKey(source);
    const options = optionsByKey.get(key);
    return {
      ...source,
      counts:
        options === undefined
          ? null
          : Object.fromEntries(
              options.map((value) => [
                value,
                counted.get(key)?.get(value) ?? 0,
              ]),
            ),
    };
  });
}
