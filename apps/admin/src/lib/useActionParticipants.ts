import type { AdminActionDto } from "@alliance/shared/client";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { parseActionDto } from "@alliance/shared/parsed-dtos";
import { useMemo } from "react";
import {
  describeCohortExpression,
  type CohortSegment,
} from "./describeCohortExpression";

export function useActionParticipants(
  actions: AdminActionDto[],
): ReadonlyMap<number, CohortSegment[]> {
  const { tags } = useTagsAdmin();
  return useMemo(() => {
    const names = {
      tagNames: new Map(tags.map((tag) => [tag.id, tag.name])),
      actionNames: new Map(actions.map((action) => [action.id, action.name])),
    };
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
  }, [actions, tags]);
}
