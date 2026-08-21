import type { AggregateViewSchema } from "@alliance/common/forms/form-schema";
import type { ActionDto } from "@alliance/shared/client";
import { tasksGetFormAggregateViews } from "@alliance/shared/client";
import { parseAggregateViewsPayload } from "@alliance/shared/lib/actionAggregates";

/** Fetches resolved aggregate views per form id (dedupes HTTP by unique form id). */
export async function fetchTaskFormProgressViewsByFormId(
  formIds: number[],
): Promise<Record<number, AggregateViewSchema[]>> {
  const uniqueFormIds = [...new Set(formIds)];
  const settled = await Promise.allSettled(
    uniqueFormIds.map(async (formId) => {
      const response = await tasksGetFormAggregateViews({
        path: { id: formId },
      });
      const views = parseAggregateViewsPayload(response.data?.aggregateViews);
      return [formId, views] as const;
    }),
  );
  const fetchedByFormId = settled.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return [uniqueFormIds[i], []] as const;
  });
  return Object.fromEntries(fetchedByFormId) as Record<
    number,
    AggregateViewSchema[]
  >;
}

export function mapFormViewsToActionIds(
  entries: { actionId: number; formId: number }[],
  viewsByFormId: Record<number, AggregateViewSchema[]>,
): Record<number, AggregateViewSchema[]> {
  return Object.fromEntries(
    entries.map(({ actionId, formId }) => [
      actionId,
      viewsByFormId[formId] ?? [],
    ]),
  ) as Record<number, AggregateViewSchema[]>;
}

export function sidebarProgressActionCandidates(
  actions: ActionDto[],
): { actionId: number; formId: number }[] {
  return actions
    .filter(
      (action) =>
        action.status === "member_action" &&
        action.shouldParticipate &&
        action.taskFormId != null,
    )
    .map((action) => ({
      actionId: action.id,
      formId: action.taskFormId!,
    }));
}
