import { cn } from "@alliance/shared/styles/util";
import { WORK_HEADLINE, WORK_SUBHEAD } from "../content";
import { CommitCard, TaskCard, UpdateCard } from "../graphics/ProductCards";
import { SITE_COL, SectionHeading } from "../ui";

export function HowItWorks() {
  return (
    <section className="bg-[var(--site-surface-alt)] pt-20 pb-36 lg:pt-28 lg:pb-48">
      <div className={cn(SITE_COL, "flex flex-col gap-6")}>
        <div className="flex flex-col gap-2">
          <SectionHeading>{WORK_HEADLINE}</SectionHeading>
          <p className="max-w-[42rem] text-[1.05rem] leading-snug text-[var(--site-ink)]/70 sm:text-[1.2rem]">
            {WORK_SUBHEAD}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <CommitCard />
          <TaskCard />
          <UpdateCard />
        </div>
      </div>
    </section>
  );
}
