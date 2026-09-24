/**
 * Parsed DTO wrappers
 *
 * The generated client types (`client/types.gen.ts`) model a jsonb-backed
 * field as a bare `{ [key: string]: unknown }`. These helpers validate such a
 * field once at the API boundary and hand back a real type. For
 * `cohortExpression` that means the same dto with a `CohortExpression` on it,
 * the client-side counterpart of the server's
 * `parseAction`/`parseFollowUpForm`.
 *
 * Unlike the server's request parsing, which throws because invalid input
 * there is a bug to fail fast on, these degrade so screens stay usable and can
 * show a warning instead of crashing. The failure is also logged here, with
 * the raw value, so call sites don't each need to.
 *
 * The parsed types use `cohortExpression?: CohortExpression` (not `| null`)
 * so they stay assignable to their generated counterparts and can flow into
 * existing `AdminActionDto`/`AdminFollowUpFormDto`-typed props unchanged.
 */

import {
  cohortExpressionSchema,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import { readStoredFormAnswers } from "@alliance/common/forms/form-responses";
import { variableInputFieldsById } from "@alliance/common/forms/form-schema";
import {
  storedQuestionFields,
  submittedQuestionFields,
} from "@alliance/common/forms/stored-schema";
import type { VariableSourceHistory } from "@alliance/common/forms/variable-evaluation";
import {
  readVisibilityValidatorResults,
  type VisibilityValidatorResults,
} from "@alliance/common/forms/visibility";
import { R, type Result } from "@alliance/common/result";
import type { ZodError } from "zod";
import type {
  AdminActionDto,
  AdminFollowUpFormDto,
  FormResponseHistoryDto,
} from "./client/types.gen";

export type ParsedActionDto = Omit<AdminActionDto, "cohortExpression"> & {
  cohortExpression?: CohortExpression;
};

export type ParsedFollowUpFormDto = Omit<
  AdminFollowUpFormDto,
  "cohortExpression"
> & {
  cohortExpression?: CohortExpression;
};

function parseCohortExpressionField(
  value: unknown,
  context: string,
): { expression: CohortExpression | undefined; error: ZodError | null } {
  if (value == null) return { expression: undefined, error: null };
  const parsed = cohortExpressionSchema.safeParse(value);
  if (parsed.success) return { expression: parsed.data, error: null };
  console.error(
    `Stored cohort expression on ${context} failed to parse`,
    parsed.error,
    value,
  );
  return { expression: undefined, error: parsed.error };
}

export function parseActionDto(dto: AdminActionDto): {
  action: ParsedActionDto;
  cohortExpressionError: ZodError | null;
} {
  const { expression, error } = parseCohortExpressionField(
    dto.cohortExpression,
    `action ${dto.id}`,
  );
  return {
    action: { ...dto, cohortExpression: expression },
    cohortExpressionError: error,
  };
}

export function parseFollowUpFormDto(dto: AdminFollowUpFormDto): {
  followUpForm: ParsedFollowUpFormDto;
  cohortExpressionError: ZodError | null;
} {
  const { expression, error } = parseCohortExpressionField(
    dto.cohortExpression,
    `follow-up form ${dto.id}`,
  );
  return {
    followUpForm: { ...dto, cohortExpression: expression },
    cohortExpressionError: error,
  };
}

/**
 * A form response's saved `visibilityValidatorResults`, logging what
 * {@link readVisibilityValidatorResults} could not read so call sites don't
 * each need to.
 */
export function parseVisibilityValidatorResults(
  value: unknown,
): Result<VisibilityValidatorResults, ZodError> {
  const read = readVisibilityValidatorResults(value);
  if (R.isFailure(read)) {
    console.error(
      "Saved visibility validator results are not an object",
      read.error,
      value,
    );
    return read;
  }

  const { verdicts, unreadable } = read.value;
  if (unreadable.length > 0) {
    console.error(
      "Dropped unreadable saved visibility validator verdicts",
      unreadable,
      value,
    );
  }

  return R.success(verdicts);
}

/** Fails whole when any answer or form version can't be read. */
export function parseFormResponseHistory(
  dto: FormResponseHistoryDto,
): Result<VariableSourceHistory, Error> {
  return R.fromThrowable(() => {
    const current = R.unwrap(storedQuestionFields(dto.schema));
    return {
      fields: variableInputFieldsById(current),
      responses: dto.responses.map((response) => {
        const unreadable = `Can't read response ${response.id}`;
        return {
          answers: R.expect(
            readStoredFormAnswers(response.answers),
            unreadable,
          ),
          fields: variableInputFieldsById(
            R.expect(
              submittedQuestionFields({
                snapshot: response.schemaSnapshot,
                current,
              }),
              unreadable,
            ),
          ),
        };
      }),
    };
  });
}
