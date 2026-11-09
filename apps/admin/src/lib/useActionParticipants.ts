import type { AdminActionDto } from "@alliance/shared/client";
import { useFormDisplaySlugs } from "@alliance/shared/lib/useFormsAdmin";
import { parseActionDto } from "@alliance/shared/parsed-dtos";
import { useMemo } from "react";
import {
  cohortNames,
  describeCohortExpression,
  type CohortSegment,
} from "./describeCohortExpression";
import { useTagsAdmin } from "./useTagsAdmin";

export function useActionParticipants(
  actions: AdminActionDto[],
): ReadonlyMap<number, CohortSegment[]> {
  const { tags } = useTagsAdmin();
  const formDisplaySlugs = useFormDisplaySlugs();
  return useMemo(() => {
    const names = cohortNames({ tags, actions, formDisplaySlugs });
    return new Map(
      actions.map((dto) => {
        const { action, cohortExpressionError } = parseActionDto(dto);
        return [
          dto.id,
          cohortExpressionError
            ? [{ text: "Invalid cohort expression" }]
            : describeCohortExpression(action.cohortExpression, names),
        ];
      }),
    );
  }, [actions, tags, formDisplaySlugs]);
}
