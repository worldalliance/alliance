import { ActionActivityType } from "@alliance/common/actionActivity";
import type { AnyField } from "@alliance/common/forms/form-schema";
import { storedQuestionFields } from "@alliance/common/forms/stored-schema";
import {
  aggregateSourceKey,
  type VariableAggregateCounts,
  type VariableAggregateSource,
} from "@alliance/common/forms/variable-aggregates";
import { groupBy } from "es-toolkit";
import { In, type EntityManager } from "typeorm";
import { Form, loadedFormSnapshot } from "./entities/form.entity";
import { formSchemaOf } from "./form-snapshot-schema";

export type VariableAggregate = VariableAggregateSource & {
  /** `null` when the form is gone or no longer has that multiselect. */
  counts: VariableAggregateCounts | null;
};

export type VariableAnsweredCount = VariableAggregateSource & {
  /** `null` when the form is gone or no longer has that question. */
  count: number | null;
};

type CountRow = { fieldId: string; value: string; count: number };

/**
 * Per member, only the latest submission to the form that isn't a withdrawal
 * counts. Guests have no user and don't count. Takes the form id as `$1` and
 * the withdrawal activity type as `$3`.
 */
const LATEST_ANSWERS = `WITH latest AS (
  SELECT DISTINCT ON (r."userId") r.answers
  FROM form_response r
  WHERE r."formId" = $1
    AND r."userId" IS NOT NULL
    AND r."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM action_activity a
      WHERE a."taskFormResponseId" = r.id AND a.type = $3
        AND a."deletedAt" IS NULL
    )
  ORDER BY r."userId", r."createdAt" DESC, r.id DESC
)`;

/** An option repeated within one answer counts once. */
function countLatestAnswers(params: {
  em: EntityManager;
  formId: number;
  fieldIds: string[];
}): Promise<CountRow[]> {
  return params.em.query(
    `${LATEST_ANSWERS}
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
 * An answer counts unless it is missing, null, false, blank, or an empty list
 * or object, so an unticked checkbox or an empty upload doesn't.
 */
function countLatestAnswered(params: {
  em: EntityManager;
  formId: number;
  fieldIds: string[];
}): Promise<Omit<CountRow, "value">[]> {
  return params.em.query(
    `${LATEST_ANSWERS}
     SELECT f.field_id AS "fieldId", count(*)::int AS count
     FROM latest
     CROSS JOIN unnest($2::text[]) AS f(field_id)
     CROSS JOIN LATERAL (SELECT latest.answers -> f.field_id AS answer) a
     WHERE a.answer IS NOT NULL
       AND a.answer NOT IN ('null'::jsonb, 'false', '[]', '{}')
       AND (jsonb_typeof(a.answer) <> 'string' OR btrim(a.answer #>> '{}') <> '')
     GROUP BY f.field_id`,
    [params.formId, params.fieldIds, ActionActivityType.USER_WONT_COMPLETE],
  );
}

/** Each source's question in its form's current version, keyed by `aggregateSourceKey`. */
async function currentQuestions(params: {
  em: EntityManager;
  sources: readonly VariableAggregateSource[];
}): Promise<Map<string, AnyField>> {
  const formIds = [...new Set(params.sources.map((s) => s.sourceFormId))];
  const forms = await params.em.find(Form, {
    where: { id: In(formIds) },
    relations: { formSnapshot: true },
  });
  const questions = new Map<string, AnyField>();
  for (const form of forms) {
    const fields = storedQuestionFields(formSchemaOf(loadedFormSnapshot(form)));
    if (!fields.ok) continue;
    for (const field of fields.value) {
      questions.set(
        aggregateSourceKey({ sourceFormId: form.id, fieldId: field.id }),
        field,
      );
    }
  }
  return questions;
}

function countableByForm(
  sources: readonly VariableAggregateSource[],
  countable: (source: VariableAggregateSource) => boolean,
): { formId: number; fieldIds: string[] }[] {
  const byForm = groupBy(sources.filter(countable), (s) => s.sourceFormId);
  return Object.entries(byForm).map(([formId, formSources]) => ({
    formId: Number(formId),
    fieldIds: [...new Set(formSources.map((source) => source.fieldId))],
  }));
}

/**
 * Counts the members whose latest submission answered each source's
 * question, from each form's current version. Sources on one form share one
 * query.
 */
export async function countVariableAnswered(params: {
  em: EntityManager;
  sources: readonly VariableAggregateSource[];
}): Promise<VariableAnsweredCount[]> {
  const { em, sources } = params;
  const questions = await currentQuestions({ em, sources });
  const counted = new Map<string, number>();
  await Promise.all(
    countableByForm(sources, (source) =>
      questions.has(aggregateSourceKey(source)),
    ).map(async ({ formId, fieldIds }) => {
      for (const row of await countLatestAnswered({ em, formId, fieldIds })) {
        counted.set(
          aggregateSourceKey({ sourceFormId: formId, fieldId: row.fieldId }),
          row.count,
        );
      }
    }),
  );
  return sources.map((source) => {
    const key = aggregateSourceKey(source);
    return {
      ...source,
      count: questions.has(key) ? (counted.get(key) ?? 0) : null,
    };
  });
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
  const questions = await currentQuestions({ em, sources });
  const optionsByKey = new Map<string, string[]>();
  for (const [key, field] of questions) {
    if (field.kind === "multiselect") {
      optionsByKey.set(
        key,
        field.options.map((option) => option.value),
      );
    }
  }
  const countable = countableByForm(sources, (source) =>
    optionsByKey.has(aggregateSourceKey(source)),
  );
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
