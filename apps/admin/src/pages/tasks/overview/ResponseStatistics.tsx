import FormResponseStatistics from "../../../components/FormResponseStatistics";
import { countOf } from "../../../lib/formatNumber";
import type { FormResponseFilter } from "../../../lib/responseFilter";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Skeleton } from "../../../ui/Skeleton";
import { PanelNote, Section } from "../../../ui/templates/Overview";
import type { ActionReporting } from "../../action-dashboard/useActionReporting";
import type { TaskTabProps } from "../taskTabs";

/** Params the Responses tab reads to open its replays filtered by one answer. */
export const responseFilterParams = (
  filter: FormResponseFilter,
): Record<string, string> => ({
  resp_tab: "replays",
  resp_filterField: filter.fieldId,
  resp_filterOp: filter.op,
  ...(filter.value != null && { resp_filterValue: filter.value }),
});

/**
 * Each question's answers counted over the task form's responses. A bar opens
 * the Responses tab filtered to that answer.
 */
export function ResponseStatistics({
  reporting,
  openTab,
}: {
  reporting: ActionReporting;
  openTab: TaskTabProps["openTab"];
}) {
  const { taskForm, formResponses, formResponsesLoading, formResponsesFailed } =
    reporting;
  return (
    <Section
      title={
        formResponsesLoading || formResponsesFailed
          ? "Response statistics"
          : `Response statistics (${countOf(formResponses.length, "response")})`
      }
      action={
        <Button
          variant={ButtonVariant.Default}
          size="small"
          onClick={() => openTab("responses")}
        >
          View all responses
        </Button>
      }
    >
      {formResponsesFailed ? (
        <PanelNote>Couldn't load the form's responses.</PanelNote>
      ) : formResponsesLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : taskForm && formResponses.length > 0 ? (
        <FormResponseStatistics
          form={taskForm}
          responses={formResponses}
          loading={false}
          error={null}
          onFilterSelect={(filter) =>
            openTab("responses", responseFilterParams(filter))
          }
        />
      ) : (
        taskForm && <PanelNote>No responses yet.</PanelNote>
      )}
    </Section>
  );
}
