/**
 * Parsed DTO wrappers
 *
 * The generated client types (`client/types.gen.ts`) model the jsonb-backed
 * `cohortExpression` field as a bare `{ [key: string]: unknown }`. These
 * helpers validate that field once at the API boundary and hand back the same
 * dto with a real `CohortExpression` type — the client-side counterpart of
 * the server's `parseAction`/`parseFollowUpForm`.
 *
 * Unlike the server (which throws — invalid data there is a bug to fail fast
 * on), these degrade: on a failed parse the expression becomes `undefined`
 * and the zod error is returned alongside the dto, so screens stay usable and
 * can show a warning instead of crashing. The failure is also logged here,
 * with the raw value, so call sites don't each need to.
 *
 * The parsed types use `cohortExpression?: CohortExpression` (not `| null`)
 * so they stay assignable to their generated counterparts and can flow into
 * existing `ActionDto`/`FollowUpFormDto`-typed props unchanged.
 */

import {
  cohortExpressionSchema,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import type { ZodError } from "zod";
import type { ActionDto, FollowUpFormDto } from "./client/types.gen";

export type ParsedActionDto = Omit<ActionDto, "cohortExpression"> & {
  cohortExpression?: CohortExpression;
};

export type ParsedFollowUpFormDto = Omit<
  FollowUpFormDto,
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

export function parseActionDto(dto: ActionDto): {
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

export function parseFollowUpFormDto(dto: FollowUpFormDto): {
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
