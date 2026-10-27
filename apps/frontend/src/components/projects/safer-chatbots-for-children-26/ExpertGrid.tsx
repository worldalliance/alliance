import { cn } from "@alliance/shared/styles/util";
import { EXPERTS, type Expert } from "./copy";
import { PictureSlot } from "./PictureSlot";

function ExpertCard({ person }: { person: Expert }) {
  return (
    <>
      <PictureSlot src={person.imageSrc} className="mb-3 aspect-square" />
      <span className="site-sans text-lg leading-tight font-medium text-[var(--site-ink)] underline decoration-transparent underline-offset-2 group-hover:decoration-[var(--site-ink)]">
        {person.name}
      </span>
      <span className="site-sans text-base leading-snug text-[var(--site-ink)]/70">
        {person.role}
      </span>
    </>
  );
}

export function ExpertGrid({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Expert panel"
      className={cn(
        "flex flex-wrap justify-center gap-x-3 gap-y-5 text-center sm:gap-x-4 sm:gap-y-6",
        className,
      )}
    >
      {EXPERTS.map((person, idx) => (
        <li key={idx} className="w-32 sm:w-36">
          {person.href ? (
            <a
              href={person.href}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col"
            >
              <ExpertCard person={person} />
            </a>
          ) : (
            <div className="flex flex-col">
              <ExpertCard person={person} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
