import type { ReactNode } from "react";
import {
  currentMemberCount,
  farMilestones,
  GROWTH_FOOTNOTE,
  GROWTH_HEADLINE_FAR_PARTS,
  MODEL_HEADLINE,
  MODEL_PARTNER_LABEL,
  nearMilestones,
} from "../content";
import { GrowthMilestones } from "../graphics/GrowthMilestones";
import { HoursGrid } from "../graphics/HoursGrid";
import { rdHref, RedesignPage } from "../links";
import { ModelGraphicKind, type RedesignTheme } from "../theme";
import { RD_COL, RdArrow, RdTexturedPanel } from "../ui";

const graphicByKind: Record<
  ModelGraphicKind,
  (props: { theme: RedesignTheme }) => ReactNode
> = {
  [ModelGraphicKind.HoursGrid]: HoursGrid,
  [ModelGraphicKind.GrowthMilestones]: ({ theme }) => (
    <GrowthMilestones
      farHeadline={
        <>
          {GROWTH_HEADLINE_FAR_PARTS.lead}
          <a
            href={rdHref(theme.version, RedesignPage.People)}
            className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
          >
            {GROWTH_HEADLINE_FAR_PARTS.link}
          </a>
          {GROWTH_HEADLINE_FAR_PARTS.tail}
        </>
      }
      footnote={GROWTH_FOOTNOTE}
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
        <RdTexturedPanel tint="var(--rd-primary)">
          <div className="mb-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <h2 className="max-w-[44rem] text-[1.45rem] leading-snug font-normal text-white sm:text-[1.75rem]">
              {MODEL_HEADLINE}
            </h2>
            <a
              href={rdHref(theme.version, RedesignPage.Partner)}
              className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-white hover:underline"
            >
              {MODEL_PARTNER_LABEL}
              <RdArrow className="size-2.5" />
            </a>
          </div>
          <Graphic theme={theme} />
        </RdTexturedPanel>
      </div>
    </section>
  );
}
