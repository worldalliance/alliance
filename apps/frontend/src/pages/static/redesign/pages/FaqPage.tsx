import { cn } from "@alliance/shared/styles/util";
import { Plus } from "lucide-react";
import { FAQ_ITEMS } from "../docContent";
import { RedesignPage } from "../links";
import { FAQ_LEDE, FAQ_TITLE } from "../pageContent";
import { DocProse } from "../sections/DocProse";
import { PageShell } from "../sections/PageShell";
import type { RedesignTheme } from "../theme";
import { RD_COL } from "../ui";

export function RedesignFaqPage({ theme }: { theme: RedesignTheme }) {
  return (
    <PageShell
      theme={theme}
      page={RedesignPage.Faq}
      title={FAQ_TITLE}
      lede={FAQ_LEDE}
    >
      <div className={cn(RD_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <div className="max-w-[52rem]">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.id}
              id={item.id}
              className="group scroll-mt-32 border-t border-[var(--rd-ink)]/12 last:border-b"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[1.15rem] leading-snug text-[var(--rd-primary)] sm:text-[1.3rem]">
                {item.question}
                <Plus
                  className="mt-1 size-5 shrink-0 text-[var(--rd-ink)]/40 transition-transform duration-300 ease-out group-open:rotate-45"
                  aria-hidden
                />
              </summary>
              <DocProse
                version={theme.version}
                markdown={item.answer}
                className="max-w-[44rem] pb-7"
              />
            </details>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
