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
 * Unlike the server, which throws because invalid data there is a bug to fail
 * fast on, these degrade so screens stay usable and can show a warning instead
 * of crashing. The failure is also logged here, with the raw value, so call
 * sites don't each need to.
 *
 * The parsed types use `cohortExpression?: CohortExpression` (not `| null`)
 * so they stay assignable to their generated counterparts and can flow into
 * existing `AdminActionDto`/`AdminFollowUpFormDto`-typed props unchanged.
 */

import {
  cohortExpressionSchema,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import { R, type Result } from "@alliance/common/result";
import { z, type ZodError } from "zod";
import type { AdminActionDto, AdminFollowUpFormDto } from "./client/types.gen";

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

/** The verdict each visibility validator returned, keyed by validator id. */
export type VisibilityValidatorResults = Record<number, boolean>;

/** The jsonb round-trip turns the validator ids into string keys. */
const verdictEntrySchema = z.tuple([
  z.coerce.number().int().positive(),
  z.boolean(),
]);

/**
 * A form response's saved `visibilityValidatorResults`. An absent blob is a
 * response that recorded nothing, not a failure; only a blob that isn't an
 * object at all fails. An individual entry that isn't a validator id keyed to
 * a boolean is dropped, so one unreadable verdict doesn't discard the verdicts
 * beside it.
 */
export function parseVisibilityValidatorResults(
  value: unknown,
): Result<VisibilityValidatorResults, ZodError> {
  const blob = z.record(z.string(), z.unknown()).safeParse(value ?? {});
  if (!blob.success) {
    console.error(
      "Saved visibility validator results are not an object",
      blob.error,
      value,
    );
    return R.failure(blob.error);
  }

  const verdicts: VisibilityValidatorResults = {};
  const unreadable: string[] = [];
  for (const entry of Object.entries(blob.data)) {
    const parsed = verdictEntrySchema.safeParse(entry);
    if (parsed.success) {
      const [validatorId, verdict] = parsed.data;
      verdicts[validatorId] = verdict;
    } else {
      unreadable.push(entry[0]);
    }
  }
  if (unreadable.length > 0) {
    console.error(
      "Dropped unreadable saved visibility validator verdicts",
      unreadable,
      value,
    );
  }

  return R.success(verdicts);
}
