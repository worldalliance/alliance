import { cn } from "@alliance/shared/styles/util";
import { EXPERTS } from "./copy";
import { PictureSlot } from "./PictureSlot";

export function ExpertGrid({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Expert panel"
      className={cn(
        "grid grid-cols-2 gap-x-6 text-center sm:gap-x-10",
        className,
      )}
    >
      {EXPERTS.map((person, idx) => (
        <li key={idx} className="flex w-36 flex-col sm:w-44">
          <PictureSlot src={person.imageSrc} className="mb-3 aspect-square" />
          <span className="site-sans text-lg leading-tight font-medium text-[var(--site-ink)]">
            {person.name}
          </span>
          <span className="site-sans text-base leading-snug text-[var(--site-ink)]/70">
            {person.role}
          </span>
        </li>
      ))}
    </ul>
  );
}
