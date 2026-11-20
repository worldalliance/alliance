import { scaleLinear } from "d3";
import React, { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { recentInviteFunnelRange } from "../../lib/recentInviteFunnelRange";
import { useInviteFunnelAdmin } from "../../lib/useInviteFunnelAdmin";
import { secondaryButtonClass } from "../ui/controlStyles";
import DateRangeInputs from "../ui/DateRangeInputs";
import Section from "../ui/Section";

const InviteFunnelCard: React.FC = () => {
  const [inviteFunnelRange, setInviteFunnelRange] = useState(() =>
    recentInviteFunnelRange(new Date(), 14),
  );

  const {
    data: inviteFunnel,
    isPending: inviteFunnelLoading,
    error: inviteFunnelError,
  } = useInviteFunnelAdmin(inviteFunnelRange);

  const inviteFunnelGeometry = useMemo(() => {
    if (!inviteFunnel) return null;

    const bars = [
      {
        label: "Invites Created",
        value: inviteFunnel.invitesCreated,
        color: "#6366f1",
      },
      {
        label: "Invites Used",
        value: inviteFunnel.invitesUsed,
        color: "#8b5cf6",
      },
      {
        label: "Signed Contract",
        value: inviteFunnel.contractSigned,
        color: "#a855f7",
      },
      {
        label: "Finished Onboarding",
        value: inviteFunnel.onboardingCompleted,
        color: "#c084fc",
      },
    ];

    const width = 600;
    const height = 300;
    const margin = { top: 28, right: 32, bottom: 48, left: 56 };
    const maxValue = Math.max(1, ...bars.map((b) => b.value));

    const barAreaWidth = width - margin.left - margin.right;
    const barWidth = Math.min(80, barAreaWidth / bars.length - 16);
    const totalBarsWidth = bars.length * barWidth + (bars.length - 1) * 16;
    const offsetX = margin.left + (barAreaWidth - totalBarsWidth) / 2;

    const yScale = scaleLinear()
      .domain([0, maxValue * 1.15])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const yTicks = yScale.ticks(5);

    return {
      bars,
      width,
      height,
      margin,
      barWidth,
      offsetX,
      yScale,
      yTicks,
      maxValue,
    };
  }, [inviteFunnel]);

  return (
    <Section
      title="Invite conversion funnel"
      actions={
        <>
          <DateRangeInputs
            value={inviteFunnelRange}
            onChange={setInviteFunnelRange}
          />
          <button
            type="button"
            onClick={() =>
              setInviteFunnelRange(recentInviteFunnelRange(new Date(), 7))
            }
            className={secondaryButtonClass}
          >
            Last 7 days
          </button>
        </>
      }
    >
      <div className="relative">
        {inviteFunnelLoading && (
          <p className="text-sm text-zinc-600">Loading invite funnel…</p>
        )}
        {inviteFunnelError && (
          <p role="alert" className="text-sm text-red-600">
            {adminRefusalMessage(
              inviteFunnelError,
              "Unable to load the invite funnel.",
            )}
          </p>
        )}
        {inviteFunnelGeometry && inviteFunnel && (
          <svg
            viewBox={`0 0 ${inviteFunnelGeometry.width} ${inviteFunnelGeometry.height}`}
            className="mx-auto w-full max-w-[600px]"
          >
            {inviteFunnelGeometry.yTicks.map((tick) => (
              <g key={`funnel-y-${tick}`}>
                <line
                  x1={inviteFunnelGeometry.margin.left}
                  x2={
                    inviteFunnelGeometry.width -
                    inviteFunnelGeometry.margin.right
                  }
                  y1={inviteFunnelGeometry.yScale(tick)}
                  y2={inviteFunnelGeometry.yScale(tick)}
                  stroke="#e5e7eb"
                  strokeDasharray="4 6"
                />
                <text
                  x={inviteFunnelGeometry.margin.left - 10}
                  y={inviteFunnelGeometry.yScale(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-gray-500 text-xs"
                >
                  {tick}
                </text>
              </g>
            ))}

            {inviteFunnelGeometry.bars.map((bar, idx) => {
              const x =
                inviteFunnelGeometry.offsetX +
                idx * (inviteFunnelGeometry.barWidth + 16);
              const barHeight =
                inviteFunnelGeometry.yScale(0) -
                inviteFunnelGeometry.yScale(bar.value);
              const y = inviteFunnelGeometry.yScale(bar.value);

              return (
                <g key={bar.label}>
                  <rect
                    x={x}
                    y={y}
                    width={inviteFunnelGeometry.barWidth}
                    height={Math.max(0, barHeight)}
                    rx={4}
                    fill={bar.color}
                  />
                  <text
                    x={x + inviteFunnelGeometry.barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="fill-gray-700 text-xs font-semibold"
                  >
                    {bar.value}
                  </text>
                  {idx > 0 && inviteFunnelGeometry.bars[idx - 1].value > 0 && (
                    <text
                      x={x + inviteFunnelGeometry.barWidth / 2}
                      y={y - 18}
                      textAnchor="middle"
                      className="fill-gray-400 text-[10px]"
                    >
                      {Math.round(
                        (bar.value / inviteFunnelGeometry.bars[idx - 1].value) *
                          100,
                      )}
                      %
                    </text>
                  )}
                  <text
                    x={x + inviteFunnelGeometry.barWidth / 2}
                    y={
                      inviteFunnelGeometry.height -
                      inviteFunnelGeometry.margin.bottom +
                      16
                    }
                    textAnchor="middle"
                    className="fill-gray-600 text-[11px]"
                  >
                    {bar.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </Section>
  );
};

export default InviteFunnelCard;
