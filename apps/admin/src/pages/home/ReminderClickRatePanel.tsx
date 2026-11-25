import { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useReminderGroupClickRatesAdmin } from "../../lib/useReminderGroupClickRatesAdmin";
import { Skeleton } from "../../ui/Skeleton";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import {
  ChartTip,
  DateRangeFields,
  PanelControls,
  PanelStack,
  TipRow,
} from "./chartParts";
import { lastMonths } from "./homeRules";
import {
  REMINDER_CHANNEL,
  ReminderClickRateBarChart,
} from "./ReminderClickRateBarChart";
import {
  channelBars,
  pointsInRange,
  reminderActionAggregates,
  ReminderChannel,
  reminderChannels,
  type ReminderActionChannelBar,
} from "./reminderClickRateData";

type Hovered = { bar: ReminderActionChannelBar; channel: ReminderChannel };

/** How often reminder links were clicked, per task, by email and by text. */
export function ReminderClickRatePanel({ className }: { className?: string }) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
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
          empty={inRange.length === 0}
          emptyTitle="No sent reminder groups with email or text link clicks in this date range"
        >
          <div className="relative flex flex-col gap-4">
            {reminderChannels.map((channel) => (
              <ReminderClickRateBarChart
                key={channel}
                bars={barsByChannel[channel]}
                channel={channel}
                onHoverBar={(bar) => setHovered(bar && { bar, channel })}
              />
            ))}
            {hovered && (
              <ChartTip
                title={hovered.bar.actionName}
                className="top-0 right-0"
              >
                <TipRow label="Channel">
                  {REMINDER_CHANNEL[hovered.channel].label}
                </TipRow>
                <TipRow label="Click rate">
                  {Math.round(hovered.bar.averageRate * 100)}%
                </TipRow>
                <TipRow label="Reminder groups averaged">
                  {formatCount(hovered.bar.reminderGroupCount)}
                </TipRow>
                <TipRow label="Clicked / sent">
                  {hovered.bar.clickedCount}/{hovered.bar.sentCount}
                </TipRow>
                <TipRow label="Task ID">{hovered.bar.actionId}</TipRow>
              </ChartTip>
            )}
          </div>
        </ContentState>
      </PanelStack>
    </Panel>
  );
}
