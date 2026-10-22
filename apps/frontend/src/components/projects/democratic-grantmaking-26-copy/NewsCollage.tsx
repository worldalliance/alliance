import { cn } from "@alliance/shared/styles/util";
import { NEWS_ARTICLES, NEWS_HEADING } from "./copy";

export function NewsCollage({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="news-heading"
      className={cn(
        "site-sans flex flex-col gap-5 rounded-lg bg-zinc-100 p-6 sm:p-8",
        className,
      )}
    >
      <h2
        id="news-heading"
        className="text-lg font-semibold text-[var(--site-ink)] sm:text-xl"
      >
        {NEWS_HEADING}
      </h2>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 md:grid-cols-4">
        {NEWS_ARTICLES.map((article) => (
          <li key={article.href} className="min-w-0">
            <a
              href={article.href}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col gap-1"
            >
              <img
                src={article.imageSrc}
                alt=""
                className="mb-2 hidden aspect-video w-full rounded-md bg-zinc-200 object-cover md:block"
              />
              <span className="text-xs font-medium tracking-wide text-[var(--site-ink)]/60 uppercase">
                {article.publication}
              </span>
              <span className="text-base leading-snug font-medium text-[var(--site-ink)] underline decoration-transparent underline-offset-2 group-hover:decoration-[var(--site-ink)]">
                {article.title}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
