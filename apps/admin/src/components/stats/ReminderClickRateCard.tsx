import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { cn } from "@alliance/shared/styles/util";
import React, { useMemo, useState } from "react";
import { useReminderGroupClickRatesAdmin } from "../../lib/useReminderGroupClickRatesAdmin";
import DateRangeInputs from "../ui/DateRangeInputs";
import Section from "../ui/Section";
import ReminderClickRateBarChart, {
  reminderChannelStyles,
} from "./ReminderClickRateBarChart";
import {
  channelBars,
  pointsInRange,
  reminderActionAggregates,
  ReminderChannel,
  reminderChannels,
  type ReminderActionChannelBar,
} from "./reminderClickRateData";

type HoveredReminderActionBar = {
  bar: ReminderActionChannelBar;
  channel: ReminderChannel;
};

const ReminderClickRateCard: React.FC = () => {
  const [hoveredReminderActionBar, setHoveredReminderActionBar] =
    useState<HoveredReminderActionBar | null>(null);
  const [reminderClickRateRange, setReminderClickRateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    return {
      start: dateToInputValue(start),
      end: dateToInputValue(end),
    };
  });

  const {
    data: reminderGroupClickRatePoints = [],
    isPending: reminderGroupClickRatesLoading,
    isError: reminderGroupClickRatesLoadFailed,
  } = useReminderGroupClickRatesAdmin();

  const filteredReminderGroupClickRatePoints = useMemo(
    () => pointsInRange(reminderGroupClickRatePoints, reminderClickRateRange),
    [reminderGroupClickRatePoints, reminderClickRateRange],
  );

  const aggregates = useMemo(
    () => reminderActionAggregates(filteredReminderGroupClickRatePoints),
    [filteredReminderGroupClickRatePoints],
  );

  const barsByChannel = useMemo<
    Record<ReminderChannel, ReminderActionChannelBar[]>
  >(
    () => ({
      [ReminderChannel.Email]: channelBars(aggregates, ReminderChannel.Email),
      [ReminderChannel.Text]: channelBars(aggregates, ReminderChannel.Text),
    }),
    [aggregates],
  );

  return (
    <Section
      title="Reminder link click rate by action"
      actions={
        <DateRangeInputs
          value={reminderClickRateRange}
          onChange={setReminderClickRateRange}
        />
      }
    >
      <div className="relative">
        {reminderGroupClickRatesLoading &&
          filteredReminderGroupClickRatePoints.length === 0 && (
            <p className="text-sm text-zinc-600">Loading…</p>
          )}
        {reminderGroupClickRatesLoadFailed && (
          <p className="text-sm text-red-600">
            Unable to load reminder click rates.
          </p>
        )}
        {!reminderGroupClickRatesLoading &&
          !reminderGroupClickRatesLoadFailed &&
          filteredReminderGroupClickRatePoints.length === 0 && (
            <p className="text-sm text-gray-600">
              No sent reminder groups with email/text link clicks in this date
              range.
            </p>
          )}
        {filteredReminderGroupClickRatePoints.length > 0 && (
          <div className="flex flex-col gap-4">
            {reminderChannels.map((channel) => (
              <ReminderClickRateBarChart
                key={channel}
                bars={barsByChannel[channel]}
                channel={channel}
                onHoverBar={(bar) =>
                  setHoveredReminderActionBar(bar && { bar, channel })
                }
              />
            ))}
          </div>
        )}

        {hoveredReminderActionBar && (
          <div className="absolute right-4 top-4 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[250px] pointer-events-none">
            <p className="font-semibold text-gray-900 max-w-[260px]">
              {hoveredReminderActionBar.bar.actionName}
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">Channel</span>
                <span className="font-medium text-gray-900 capitalize">
                  {hoveredReminderActionBar.channel}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">Click rate</span>
                <span
                  className={cn(
                    "font-medium",
                    reminderChannelStyles[hoveredReminderActionBar.channel]
                      .rateClassName,
                  )}
                >
                  {Math.round(hoveredReminderActionBar.bar.averageRate * 100)}%
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">Reminder groups averaged</span>
                <span className="font-medium text-gray-900">
                  {hoveredReminderActionBar.bar.reminderGroupCount}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">Clicked / Sent</span>
                <span className="font-medium text-gray-900">
                  {hoveredReminderActionBar.bar.clickedCount}/
                  {hoveredReminderActionBar.bar.sentCount}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-gray-100 pt-1 mt-1">
                <span className="text-gray-600">Action ID</span>
                <span className="font-medium text-gray-900">
                  {hoveredReminderActionBar.bar.actionId}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
};

export default ReminderClickRateCard;
