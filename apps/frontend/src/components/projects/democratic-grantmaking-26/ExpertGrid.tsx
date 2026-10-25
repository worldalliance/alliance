import { cn } from "@alliance/shared/styles/util";
import { FEATURED_PEOPLE } from "./placeholders";

export function ExpertGrid({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Expert panel"
      className={cn(
        "grid w-full grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-5 text-center sm:gap-x-4 sm:gap-y-6",
        className,
      )}
    >
      {FEATURED_PEOPLE.map((person) => {
        const content = (
          <>
            <img
              src={person.imageSrc}
              alt=""
              className="mb-3 aspect-square rounded-md object-cover"
            />
            <span
              className={cn(
                "site-sans text-lg leading-tight font-medium text-[var(--site-ink)]",
                person.href &&
                  "underline decoration-transparent underline-offset-2 group-hover:decoration-[var(--site-ink)]",
              )}
            >
              {person.name}
            </span>
            <span className="site-sans text-base leading-snug text-[var(--site-ink)]/70">
              {person.role}
            </span>
          </>
        );
        return (
          <li key={person.name} className="min-w-0">
            {person.href ? (
              <a
                href={person.href}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col"
              >
                {content}
              </a>
            ) : (
              <div className="flex flex-col">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
