import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { WORK_HEADLINE, WORK_SUBHEAD } from "../content";
import {
  CommitCard,
  CommitSignatureCard,
  TaskCard,
  TaskProgressCard,
  UpdateCard,
  UpdateSlideCard,
} from "../graphics/ProductCards";
import { ProductCardKind, type RedesignTheme } from "../theme";
import { RD_COL, SectionHeading } from "../ui";

export const cardsByKind: Record<ProductCardKind, () => ReactNode> = {
  [ProductCardKind.Typed]: () => (
    <>
      <CommitCard />
      <TaskCard />
      <UpdateCard />
    </>
  ),
  [ProductCardKind.Signature]: () => (
    <>
      <CommitSignatureCard />
      <TaskProgressCard />
      <UpdateSlideCard />
    </>
  ),
};

export function HowItWorks({ theme }: { theme: RedesignTheme }) {
  const Cards = cardsByKind[theme.productCards];

  return (
    <section className="bg-[var(--rd-surface-alt)] pt-20 pb-36 lg:pt-28 lg:pb-48">
      <div className={cn(RD_COL, "flex flex-col gap-6")}>
        <div className="flex flex-col gap-2">
          <SectionHeading>{WORK_HEADLINE}</SectionHeading>
          <p className="max-w-[42rem] text-[1.05rem] leading-snug text-[var(--rd-ink)]/70 sm:text-[1.2rem]">
            {WORK_SUBHEAD}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Cards />
        </div>
      </div>
    </section>
  );
}
