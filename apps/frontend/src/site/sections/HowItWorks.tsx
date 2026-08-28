import { cn } from "@alliance/shared/styles/util";
import { WORK_HEADLINE, WORK_SUBHEAD } from "../content";
import { CommitCard, TaskCard, UpdateCard } from "../graphics/ProductCards";
import { BandHeading } from "../PageShell";
import { SectionSubtitle, SITE_COL } from "../ui";

export function HowItWorks() {
  return (
    <section className="bg-[var(--site-surface)] pt-16 pb-16 lg:py-36">
      <div className={cn(SITE_COL, "flex flex-col gap-6")}>
        <div className="flex flex-col gap-3">
          <BandHeading>{WORK_HEADLINE}</BandHeading>
          <SectionSubtitle>{WORK_SUBHEAD}</SectionSubtitle>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <CommitCard />
          <TaskCard />
          <UpdateCard />
        </div>
      </div>
    </section>
  );
}
