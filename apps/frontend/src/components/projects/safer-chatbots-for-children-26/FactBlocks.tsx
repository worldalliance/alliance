import { cn } from "@alliance/shared/styles/util";
import { FACTS } from "./copy";

export function FactBlocks({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Key facts"
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6",
        className,
      )}
    >
      {FACTS.map((fact) => (
        <li
          key={fact.headline}
          className="site-sans flex flex-col gap-2 rounded-lg bg-zinc-100 p-6 sm:p-8"
        >
          <p className="text-2xl leading-tight font-semibold text-[var(--site-ink)] sm:text-3xl">
            {fact.headline}
          </p>
          <a
            href={fact.href}
            target="_blank"
            rel="noreferrer"
            className="text-base text-[var(--site-ink)]/70 underline underline-offset-2 hover:text-[var(--site-ink)]"
          >
            {fact.subtitle}
          </a>
        </li>
      ))}
    </ul>
  );
}
