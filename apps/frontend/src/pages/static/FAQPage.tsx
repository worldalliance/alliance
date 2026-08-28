import { cn } from "@alliance/shared/styles/util";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { FAQ_ITEMS } from "../../site/docContent";
import { DocProse } from "../../site/DocProse";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Frequently asked questions — The Alliance",
    url: "/faq",
  });
}

const FAQ_TITLE = "Frequently asked questions";
const FAQ_LEDE =
  "If your question is not here, the guide covers the same ground at length.";

export default function FAQPage() {
  const [searchParams] = useSearchParams();
  // `?question=` opens one row, which is how the app deep-links into the page.
  const question = searchParams.get("question");

  return (
    <PageShell title={FAQ_TITLE} subtitle={FAQ_LEDE}>
      <div className={cn(SITE_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <div className="max-w-[52rem]">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.id}
              id={item.id}
              open={question === item.id}
              className="group scroll-mt-32 border-t border-[var(--site-ink)]/12 last:border-b"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[1.15rem] leading-snug text-[var(--site-primary)] sm:text-[1.3rem]">
                {item.question}
                <Plus
                  className="mt-1 size-5 shrink-0 text-[var(--site-ink)]/40 transition-transform duration-300 ease-out group-open:rotate-45"
                  aria-hidden
                />
              </summary>
              <DocProse markdown={item.answer} className="max-w-[44rem] pb-7" />
            </details>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
