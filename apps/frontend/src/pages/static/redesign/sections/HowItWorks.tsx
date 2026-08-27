import { cn } from "@alliance/shared/styles/util";
import { WORK_HEADLINE } from "../content";
import { CommitCard, TaskCard, UpdateCard } from "../graphics/ProductCards";
import { RD_COL, SectionHeading } from "../ui";

export function HowItWorks() {
  return (
    <section className="bg-[var(--rd-surface-alt)] pt-20 pb-36 lg:pt-28 lg:pb-48">
      <div className={cn(RD_COL, "flex flex-col gap-6")}>
        <SectionHeading>{WORK_HEADLINE}</SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          <CommitCard />
          <TaskCard />
          <UpdateCard />
        </div>
      </div>
    </section>
  );
}
