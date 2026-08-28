import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { Link } from "react-router";
import {
  farMilestones,
  GROWTH_FOOTNOTE,
  GROWTH_HEADLINE_FAR_PARTS,
  MODEL_HEADLINE,
  MODEL_PARTNER_LABEL,
  nearMilestones,
} from "../content";
import { GrowthMilestones } from "../graphics/GrowthMilestones";
import { PARTNER_HREF, PEOPLE_HREF } from "../links";
import { SITE_COL, SiteArrow, TexturedPanel } from "../ui";

/** Matches the priority row's pull, so both straddle the section above them. */
const OVERLAP = "-mt-[7%] sm:-mt-[6%] lg:-mt-[5%]";

export function ModelSection() {
  const { data: memberCount } = useAllianceMemberCount();

  return (
    // `flow-root` keeps the pulled-up panel from dragging the surface up with it.
    <section className="flow-root bg-[var(--site-surface)] pb-16 md:pb-20 lg:pb-24">
      <div className={`${SITE_COL} ${OVERLAP} relative`}>
        <TexturedPanel tint="var(--site-primary)">
          <div className="mb-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <h2 className="max-w-[44rem] text-[1.45rem] leading-snug font-normal text-white sm:text-[1.75rem]">
              {MODEL_HEADLINE}
            </h2>
            <Link
              to={PARTNER_HREF}
              className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-white hover:underline"
            >
              {MODEL_PARTNER_LABEL}
              <SiteArrow className="size-2.5" />
            </Link>
          </div>
          <GrowthMilestones
            farHeadline={
              <>
                {GROWTH_HEADLINE_FAR_PARTS.lead}
                <Link
                  to={PEOPLE_HREF}
                  className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
                >
                  {GROWTH_HEADLINE_FAR_PARTS.link}
                </Link>
                {GROWTH_HEADLINE_FAR_PARTS.tail}
              </>
            }
            footnote={GROWTH_FOOTNOTE}
            near={nearMilestones}
            far={farMilestones}
            members={memberCount ?? 0}
          />
        </TexturedPanel>
      </div>
    </section>
  );
}
