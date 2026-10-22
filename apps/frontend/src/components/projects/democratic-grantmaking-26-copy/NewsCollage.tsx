import { cn } from "@alliance/shared/styles/util";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { NEWS_ARTICLES, NEWS_HEADING } from "./copy";

export function NewsCollage({ className }: { className?: string }) {
  const track = useRef<HTMLUListElement>(null);

  const step = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const cards = [...el.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    const offsets = cards.map((card) => card.offsetLeft - cards[0].offsetLeft);
    const current =
      offsets.filter((offset) => offset <= el.scrollLeft + 1).length - 1;
    const next = Math.min(Math.max(current + direction, 0), cards.length - 1);
    el.scrollTo({ left: offsets[next] });
  };

  return (
    <section
      aria-labelledby="news-heading"
      className={cn(
        "site-sans flex flex-col gap-4 overflow-hidden rounded-lg bg-zinc-100 p-4 sm:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="news-heading"
          className="text-lg font-semibold text-[var(--site-ink)] sm:text-xl"
        >
          {NEWS_HEADING}
        </h2>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label="Previous article"
            title="Previous article"
            onClick={() => step(-1)}
            className="rounded-full p-1.5 text-[var(--site-ink)] hover:bg-zinc-200"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next article"
            title="Next article"
            onClick={() => step(1)}
            className="rounded-full p-1.5 text-[var(--site-ink)] hover:bg-zinc-200"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <ul
        ref={track}
        className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] sm:gap-6"
      >
        {NEWS_ARTICLES.map((article) => (
          <li key={article.href} className="w-full shrink-0 snap-start">
            <a
              href={article.href}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full flex-col gap-1"
            >
              <img
                src={article.imageSrc}
                alt=""
                className="mb-2 hidden aspect-video w-full rounded-md bg-zinc-200 object-cover md:block md:max-h-64 lg:aspect-auto lg:max-h-none lg:min-h-0 lg:flex-1"
              />
              <span className="text-xs font-medium tracking-wide text-[var(--site-ink)]/60 uppercase">
                {article.publication}
              </span>
              <span className="text-sm leading-snug font-medium text-[var(--site-ink)] underline decoration-transparent underline-offset-2 group-hover:decoration-[var(--site-ink)] sm:text-base">
                {article.title}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
