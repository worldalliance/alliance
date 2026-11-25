import { scaleLinear } from "d3";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { recentInviteFunnelRange } from "../../lib/recentInviteFunnelRange";
import { useInviteFunnelAdmin } from "../../lib/useInviteFunnelAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { axisTextClass, chartColor, SERIES } from "../../ui/charts/chartColor";
import {
  DateRangeFields,
  Panel,
  PanelControls,
  PanelStack,
} from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";

type Funnel = NonNullable<ReturnType<typeof useInviteFunnelAdmin>["data"]>;

const WIDTH = 600;
const HEIGHT = 300;
const MARGIN = { top: 36, right: 32, bottom: 48, left: 56 };
const BAR_WIDTH = 80;

function FunnelChart({ funnel }: { funnel: Funnel }) {
  const bars = [
    { label: "Invites created", value: funnel.invitesCreated },
    { label: "Invites used", value: funnel.invitesUsed },
    { label: "Signed contract", value: funnel.contractSigned },
    { label: "Finished onboarding", value: funnel.onboardingCompleted },
  ];
  const slot = (WIDTH - MARGIN.left - MARGIN.right) / bars.length;
  const yScale = scaleLinear()
    .domain([0, Math.max(1, ...bars.map((bar) => bar.value)) * 1.15])
    .nice()
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mx-auto w-full max-w-xl"
      role="img"
      aria-label="Invite conversion funnel"
    >
      {yScale
        .ticks(5)
        .filter(Number.isInteger)
        .map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={chartColor.grid}
              strokeDasharray="4 6"
            />
            <text
              x={MARGIN.left - 10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className={axisTextClass}
            >
              {formatCount(tick)}
            </text>
          </g>
        ))}
      {bars.map((bar, index) => {
        const x = MARGIN.left + index * slot + (slot - BAR_WIDTH) / 2;
        const y = yScale(bar.value);
        const previous = index > 0 ? bars[index - 1].value : 0;
        return (
          <g key={bar.label}>
            <rect
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={Math.max(0, yScale(0) - y)}
              rx={4}
              fill={SERIES[0]}
            />
            <text
              x={x + BAR_WIDTH / 2}
              y={y - 6}
              textAnchor="middle"
              className="fill-fg text-xs font-semibold"
            >
              {formatCount(bar.value)}
            </text>
            {previous > 0 && (
              <text
                x={x + BAR_WIDTH / 2}
                y={y - 20}
                textAnchor="middle"
                className={axisTextClass}
              >
                {Math.round((bar.value / previous) * 100)}% of previous
              </text>
            )}
            <text
              x={x + BAR_WIDTH / 2}
              y={HEIGHT - MARGIN.bottom + 16}
              textAnchor="middle"
              className={axisTextClass}
            >
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** How many invites in the range were created, used, signed and onboarded. */
export function InviteFunnelPanel({ className }: { className?: string }) {
  const [range, setRange] = useState(() =>
    recentInviteFunnelRange(new Date(), 14),
  );
  const funnel = useInviteFunnelAdmin(range);

  return (
    <Panel title="Invite conversion funnel" className={className}>
      <PanelStack>
        <PanelControls
          actions={
            <Button
              variant={ButtonVariant.Default}
              size="small"
              onClick={() => setRange(recentInviteFunnelRange(new Date(), 7))}
            >
              Last 7 days
            </Button>
          }
        >
          <DateRangeFields range={range} onChange={setRange} />
        </PanelControls>
        <ContentState
          loading={funnel.isPending}
          skeleton={<Skeleton className="h-72 w-full" />}
          error={
            funnel.isLoadingError
              ? adminRefusalMessage(funnel.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load the invite funnel"
          onRetry={() => void funnel.refetch()}
          empty={!funnel.data}
          emptyTitle="No invites in this date range"
        >
          {funnel.data && <FunnelChart funnel={funnel.data} />}
        </ContentState>
      </PanelStack>
    </Panel>
  );
}
