import type { CohortExpression } from "@alliance/common/cohort-expression";
import { useFormDisplaySlugs } from "@alliance/shared/lib/useFormsAdmin";
import {
  cohortNames,
  cohortSegmentsText,
  describeCohortExpression,
} from "../lib/describeCohortExpression";

export default function CohortExpressionText({
  expression,
  tags,
  actions,
  className,
}: {
  expression: CohortExpression | null;
  tags: readonly { id: string; name: string }[];
  actions: readonly { id: number; name: string }[];
  className?: string;
}) {
  const formDisplaySlugs = useFormDisplaySlugs();
  return (
    <span className={className}>
      {cohortSegmentsText(
        describeCohortExpression(
          expression,
          cohortNames({ tags, actions, formDisplaySlugs }),
        ),
      )}
    </span>
  );
}
