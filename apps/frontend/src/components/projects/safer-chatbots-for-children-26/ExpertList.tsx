import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { EXPERT_ROLE, EXPERTS, type Expert } from "./copy";

function ExpertProfile({ person }: { person: Expert }) {
  return (
    <>
      <AvatarProfile
        pfp={person.imageSrc ?? null}
        size="override"
        alt=""
        className="size-14 rounded-md"
      />
      <span className="site-sans flex min-w-0 flex-col text-left text-sm leading-snug">
        <span className="text-base font-medium text-[var(--site-ink)] underline decoration-transparent underline-offset-2 group-hover:decoration-[var(--site-ink)]">
          {person.name}
        </span>
        <span className="text-[var(--site-ink)]/70">{person.title}</span>
        <span className="text-[var(--site-ink)]/70">{EXPERT_ROLE}</span>
      </span>
    </>
  );
}

export function ExpertList({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Expert advisors"
      className={cn("flex flex-wrap gap-x-8 gap-y-4", className)}
    >
      {EXPERTS.map((person) => (
        <li key={person.name}>
          {person.href ? (
            <a
              href={person.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3"
            >
              <ExpertProfile person={person} />
            </a>
          ) : (
            <div className="flex items-center gap-3">
              <ExpertProfile person={person} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
