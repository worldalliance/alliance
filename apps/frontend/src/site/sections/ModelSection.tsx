import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { Link } from "react-router";
import {
  farMilestones,
  GROWTH_FOOTNOTE,
  GROWTH_HEADLINE_FAR_PARTS,
  MODEL_HEADLINE,
  MODEL_PROJECTS_LABEL,
  nearMilestones,
} from "../content";
import { GrowthMilestones } from "../graphics/GrowthMilestones";
import { PEOPLE_HREF, PROGRESS_HREF } from "../links";
import { BandHeading, BandLede } from "../PageShell";
import { SITE_COL, SiteArrow, TexturedPanel } from "../ui";

export function ModelSection() {
  const { data: memberCount } = useAllianceMemberCount();

  return (
    <section className="bg-[var(--site-surface)] pb-16 md:pb-20 lg:pb-24">
      <div className={`${SITE_COL} flex flex-col gap-8`}>
        <div className="flex flex-col gap-3">
          <BandHeading className="max-w-[46rem]">{MODEL_HEADLINE}</BandHeading>
          <BandLede>
            {GROWTH_HEADLINE_FAR_PARTS.lead}
            <Link
              to={PEOPLE_HREF}
              className="underline decoration-[var(--site-primary)]/35 underline-offset-2 hover:decoration-[var(--site-primary)]"
            >
              {GROWTH_HEADLINE_FAR_PARTS.link}
            </Link>
            {GROWTH_HEADLINE_FAR_PARTS.tail}
          </BandLede>
        </div>
        <TexturedPanel tint="var(--site-primary)">
          <GrowthMilestones
            footnote={GROWTH_FOOTNOTE}
            near={nearMilestones}
            far={farMilestones}
            members={memberCount ?? 0}
            footer={
              <Link
                to={PROGRESS_HREF}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 text-[0.95rem] text-white hover:underline"
              >
                {MODEL_PROJECTS_LABEL}
                <SiteArrow className="size-2.5" />
              </Link>
            }
          />
        </TexturedPanel>
      </div>
    </section>
  );
}
