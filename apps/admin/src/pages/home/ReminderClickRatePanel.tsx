import { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useReminderGroupClickRatesAdmin } from "../../lib/useReminderGroupClickRatesAdmin";
import { Skeleton } from "../../ui/Skeleton";
import {
  DateRangeFields,
  Panel,
  PanelControls,
  PanelStack,
} from "../../ui/templates/Overview";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { lastMonths } from "./homeRules";
import { ReminderClickRateBarChart } from "./ReminderClickRateBarChart";
import {
  channelBars,
  pointsInRange,
  reminderActionAggregates,
  ReminderChannel,
  reminderChannels,
  type ReminderActionChannelBar,
} from "./reminderClickRateData";

/** How often reminder links were clicked, per task, by email and by text. */
export function ReminderClickRatePanel({ className }: { className?: string }) {
  const [range, setRange] = useState(() => lastMonths(5));
  const clickRates = useReminderGroupClickRatesAdmin();

  const inRange = useMemo(
    () => pointsInRange(clickRates.data ?? [], range),
    [clickRates.data, range],
  );
  const barsByChannel = useMemo<
    Record<ReminderChannel, ReminderActionChannelBar[]>
  >(() => {
    const aggregates = reminderActionAggregates(inRange);
    return {
      [ReminderChannel.Email]: channelBars(aggregates, ReminderChannel.Email),
      [ReminderChannel.Text]: channelBars(aggregates, ReminderChannel.Text),
    };
  }, [inRange]);

  return (
    <Panel title="Reminder link click rate by task" className={className}>
      <PanelStack>
        <PanelControls>
          <DateRangeFields range={range} onChange={setRange} />
        </PanelControls>
        <RefreshFailedBanner
          inline
          things="reminder click rates"
          query={clickRates}
        />
        <ContentState
          loading={clickRates.isPending}
          skeleton={<Skeleton className="h-80 w-full" />}
          error={
            clickRates.isLoadingError
              ? adminRefusalMessage(clickRates.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load reminder click rates"
          onRetry={() => void clickRates.refetch()}
          retrying={clickRates.isFetching}
          empty={inRange.length === 0}
          emptyTitle="No sent reminder groups with email or text link clicks in this date range"
        >
          <div className="flex flex-col gap-6">
            {reminderChannels.map((channel) => (
              <ReminderClickRateBarChart
                key={channel}
                bars={barsByChannel[channel]}
                channel={channel}
              />
            ))}
          </div>
        </ContentState>
      </PanelStack>
    </Panel>
  );
}
