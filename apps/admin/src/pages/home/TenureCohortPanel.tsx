import { max } from "d3";
import { useState } from "react";
import { formatCount } from "../../lib/formatNumber";
import { useAppliedQuery } from "../../lib/useAppliedQuery";
import { usePlatformTenureCohortAdmin } from "../../lib/usePlatformTenureCohortAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import {
  ControlSlot,
  NumberField,
  PanelControls,
  PanelNote,
  PanelStack,
  PanelStat,
} from "./chartParts";

const SHOWN_TASKS = 12;
const percent = (rate: number, digits: number) =>
  `${(rate * 100).toFixed(digits)}%`;

type Cohort = NonNullable<
  ReturnType<typeof usePlatformTenureCohortAdmin>["data"]
>;

function CohortTasks({ actions }: { actions: Cohort["actions"] }) {
  const mostAssigned = Math.max(
    max(actions, (action) => action.assignedCount) ?? 0,
    1,
  );
  return (
    <ul className="flex flex-col gap-2">
      {actions.slice(0, SHOWN_TASKS).map((action) => {
        const assigned = (action.assignedCount / mostAssigned) * 100;
        const completed =
          action.assignedCount > 0
            ? (action.completedCount / action.assignedCount) * assigned
            : 0;
        return (
          <li key={action.actionId} className="grid grid-cols-12 gap-3">
            <span className="col-span-3 truncate">{action.actionName}</span>
            <span
              aria-hidden="true"
              className="relative col-span-7 h-5 overflow-hidden rounded-sm bg-surface-2"
            >
              <span
                className="absolute inset-y-0 left-0 bg-line-strong"
                style={{ width: `${assigned}%` }}
              />
              <span
                className="absolute inset-y-0 left-0 bg-success"
                style={{ width: `${completed}%` }}
              />
            </span>
            <span className="col-span-2 text-right text-fg-muted tabular-nums">
              {formatCount(action.completedCount)}/
              {formatCount(action.assignedCount)} (
              {percent(action.completionRate, 0)})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The members who first joined exactly N weeks ago. Loaded when asked for. */
export function TenureCohortPanel({ className }: { className?: string }) {
  const [weeksInput, setWeeksInput] = useState("4");
  const [weeksError, setWeeksError] = useState<string | null>(null);
  const cohort = useAppliedQuery({
    useQueryFor: usePlatformTenureCohortAdmin,
    loadErrorFallback: LOAD_FAILED_FALLBACK,
  });
  const [asked, setAsked] = useState(false);

  const view = () => {
    const weeks = Number(weeksInput);
    if (!Number.isInteger(weeks) || weeks < 0) {
      setWeeksError("Weeks on platform must be a whole number.");
      return;
    }
    setWeeksError(null);
    setAsked(true);
    cohort.apply(weeks);
  };

  return (
    <Panel
      title="Task completion and churn after joining"
      description="Members who first joined exactly N weeks ago"
      className={className}
    >
      <PanelStack>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            view();
          }}
        >
          <PanelControls>
            <NumberField
              label="Weeks after joining"
              min={0}
              value={weeksInput}
              onChange={setWeeksInput}
              error={weeksError}
            />
            <ControlSlot>
              <Button
                type="submit"
                variant={ButtonVariant.Default}
                size="small"
                busy={cohort.loading}
              >
                View cohort
              </Button>
            </ControlSlot>
          </PanelControls>
        </form>
        {!asked ? (
          <PanelNote>Select View cohort to load the cohort.</PanelNote>
        ) : (
          <ContentState
            loading={cohort.loading && !cohort.data}
            skeleton={<Skeleton className="h-16 w-full" />}
            error={cohort.loadError}
            errorTitle="Couldn't load this cohort"
            onRetry={view}
            empty={!cohort.data}
            emptyTitle="No cohort for these weeks"
          >
            {cohort.data && (
              <>
                <div className="grid grid-cols-3 gap-x-6 gap-y-4 @4xl:grid-cols-6">
                  <PanelStat
                    label="Cohort size"
                    value={formatCount(cohort.data.cohortSize)}
                  />
                  <PanelStat
                    label="Task completion"
                    value={percent(cohort.data.completionRate, 1)}
                  />
                  <PanelStat
                    label="Churn rate"
                    value={percent(cohort.data.churnRate, 1)}
                  />
                  <PanelStat
                    label="Active / churned"
                    value={`${formatCount(cohort.data.activeCount)} / ${formatCount(cohort.data.churnedCount)}`}
                  />
                  <PanelStat
                    label="Completed"
                    value={formatCount(cohort.data.completedCount)}
                  />
                  <PanelStat
                    label="Assigned"
                    value={formatCount(cohort.data.assignedCount)}
                  />
                </div>
                {cohort.data.actions.length === 0 ? (
                  <PanelNote>
                    No assigned reliability tasks for this cohort.
                  </PanelNote>
                ) : (
                  <CohortTasks actions={cohort.data.actions} />
                )}
              </>
            )}
          </ContentState>
        )}
      </PanelStack>
    </Panel>
  );
}
