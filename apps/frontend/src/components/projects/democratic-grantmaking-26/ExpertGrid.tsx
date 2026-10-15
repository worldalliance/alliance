import { cn } from "@alliance/shared/styles/util";
import { FEATURED_PEOPLE } from "./placeholders";

export function ExpertGrid({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Expert panel"
      className={cn(
        "grid w-fit grid-cols-[repeat(3,80px)] gap-x-3 gap-y-5 text-center md:grid-cols-[repeat(6,100px)] lg:grid-cols-[repeat(6,125px)] sm:gap-x-4 sm:gap-y-6",
        className,
      )}
    >
      {FEATURED_PEOPLE.map((person) => (
        <li key={person.href} className="min-w-0">
          <a
            href={person.href}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col"
          >
            <img
              src={person.imageSrc}
              alt=""
              className="mb-3 size-[80px] md:size-[100px] lg:size-[125px] rounded-md object-cover"
            />
            <span className="site-sans text-lg leading-tight font-medium text-[var(--site-ink)] underline decoration-transparent underline-offset-2 group-hover:decoration-[var(--site-ink)]">
              {person.name}
            </span>
            <span className="site-sans text-base leading-snug text-[var(--site-ink)]/70">
              {person.role}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
