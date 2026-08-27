import type { ReactNode } from "react";
import texture from "../../../../assets/redesign/priority-environment.jpg";
import {
  currentMemberCount,
  farMilestones,
  GROWTH_HEADLINE_FAR,
  MODEL_HEADLINE,
  MODEL_PARTNER_LABEL,
  nearMilestones,
} from "../content";
import { GrowthMilestones } from "../graphics/GrowthMilestones";
import { HoursGrid } from "../graphics/HoursGrid";
import { ModelGraphicKind, type RedesignTheme } from "../theme";
import { RD_COL, RdArrow } from "../ui";

const graphicByKind: Record<ModelGraphicKind, () => ReactNode> = {
  [ModelGraphicKind.HoursGrid]: HoursGrid,
  [ModelGraphicKind.GrowthMilestones]: () => (
    <GrowthMilestones
      farHeadline={GROWTH_HEADLINE_FAR}
      near={nearMilestones}
      far={farMilestones}
      members={currentMemberCount}
    />
  ),
};

/** Matches the priority row's pull, so both straddle the section above them. */
const OVERLAP = "-mt-[7%] sm:-mt-[6%] lg:-mt-[5%]";

export function ModelSection({ theme }: { theme: RedesignTheme }) {
  const Graphic = graphicByKind[theme.modelGraphic];

  return (
    // `flow-root` keeps the pulled-up panel from dragging the surface up with it.
    <section className="flow-root bg-[var(--rd-surface)] pb-16 md:pb-20 lg:pb-24">
      <div className={`${RD_COL} ${OVERLAP} relative`}>
        <div
          className="relative isolate overflow-hidden px-6 py-8 sm:px-[78px] sm:py-10"
          style={{
            borderRadius: "var(--rd-radius-card)",
            backgroundColor: "var(--rd-primary)",
          }}
        >
          {/* Same duotone as the priority tiles: desaturated photo screened
              over the tint, so the marbling reads without washing out the type. */}
          <img
            src={texture}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
            style={{
              mixBlendMode: "screen",
              filter: "grayscale(1) contrast(1.05)",
              opacity: 0.62,
            }}
          />

          <div className="relative z-10">
            <div className="mb-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
              <h2 className="max-w-[28rem] text-[1.45rem] leading-snug font-normal text-white sm:text-[1.75rem]">
                {MODEL_HEADLINE}
              </h2>
              <a
                href="/outreach-partner"
                className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-white hover:underline"
              >
                {MODEL_PARTNER_LABEL}
                <RdArrow className="size-2.5" />
              </a>
            </div>

            <Graphic />
          </div>
        </div>
      </div>
    </section>
  );
}
