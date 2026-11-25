import { useState } from "react";
import { formatCount } from "../../lib/formatNumber";
import { useAppliedQuery } from "../../lib/useAppliedQuery";
import { useMemberReliabilityWindowAdmin } from "../../lib/useMemberReliabilityWindowAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import {
  NumberField,
  Panel,
  PanelControls,
  PanelNote,
  PanelStack,
  PanelStat,
} from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";

type Rate = {
  completionRate: number;
  completedCount: number;
  assignedCount: number;
};

function RateStat({
  label,
  description,
  rate,
}: {
  label: string;
  description: string;
  rate: Rate;
}) {
  return (
    <div className="flex flex-col gap-1">
      <PanelStat
        label={label}
        value={`${(rate.completionRate * 100).toFixed(1)}%`}
        note={`${formatCount(rate.completedCount)} completed / ${formatCount(rate.assignedCount)} assigned`}
      />
      <p className="text-caption text-fg-muted">{description}</p>
    </div>
  );
}

/** Completion in members' first assigned week against their fourth and later. Loaded when asked for. */
export function MemberReliabilityPanel({ className }: { className?: string }) {
  const [weeksInput, setWeeksInput] = useState("5");
  const [weeksError, setWeeksError] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const reliability = useAppliedQuery({
    useQueryFor: useMemberReliabilityWindowAdmin,
    loadErrorFallback: LOAD_FAILED_FALLBACK,
  });

  const view = () => {
    const weeks = Number(weeksInput);
    if (!Number.isInteger(weeks) || weeks < 1) {
      setWeeksError("Weeks must be a whole number of at least 1.");
      return;
    }
    setWeeksError(null);
    setAsked(true);
    reliability.apply(weeks);
  };

  return (
    <Panel title="Member reliability by assignment week" className={className}>
      <PanelStack>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            view();
          }}
        >
          <PanelControls
            actions={
              <Button
                type="submit"
                variant={ButtonVariant.Default}
                size="small"
                busy={reliability.loading}
              >
                View reliability
              </Button>
            }
          >
            <NumberField
              label="Completed task weeks"
              min={1}
              value={weeksInput}
              onChange={setWeeksInput}
              error={weeksError}
            />
          </PanelControls>
        </form>
        {!asked ? (
          <PanelNote>
            Completed tasks only. New members begin with the first member-action
            week after signing. Select View reliability to load the rates.
          </PanelNote>
        ) : (
          <ContentState
            loading={reliability.loading && !reliability.data}
            skeleton={<Skeleton className="h-20 w-full" />}
            error={reliability.loadError}
            errorTitle="Couldn't load member reliability"
            onRetry={view}
            empty={!reliability.data}
            emptyTitle="No reliability data for these weeks"
          >
            {reliability.data && (
              <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                <RateStat
                  label="First assigned week"
                  description="Members' first week of assigned tasks across the selected weeks."
                  rate={reliability.data.firstWeek}
                />
                <RateStat
                  label="Fourth assigned week or later"
                  description="Tasks taken in the selected weeks by members on assignment week four or beyond."
                  rate={reliability.data.fourthWeekOrLater}
                />
              </div>
            )}
          </ContentState>
        )}
      </PanelStack>
    </Panel>
  );
}
