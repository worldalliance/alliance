import { cn } from "@alliance/shared/styles/util";
import { PRIORITIES_NOTE, priorities, type Priority } from "../content";
import { SITE_COL, SitePicture } from "../ui";

/**
 * Below 1020px the card is a fixed 5:4 photo tile. From 1020px up, the header
 * shrinks and the card grows taller in lockstep as the four-column row
 * narrows the card, so the fixed height at any given width already has room
 * for the header and the hover-revealed description — no dynamic resize on
 * hover, so a longer description in one card never resizes its row-mates.
 */
const CARD_SIZE =
  "aspect-auto min-h-[13.5rem] min-[768px]:aspect-[5/4] min-[768px]:min-h-0 min-[1020px]:aspect-auto min-[1020px]:h-[clamp(16.7rem,23.5rem-7.15vw,18.7rem)]";

export function PriorityCard({
  priority,
  index,
  className = CARD_SIZE,
}: {
  priority: Priority;
  index: number;
  /** Replaces the card's own sizing where it has to fit a fixed height. */
  className?: string;
}) {
  return (
    <article
      tabIndex={0}
      className={cn(
        "group relative isolate flex flex-col overflow-hidden focus:outline-none",
        className,
      )}
      style={{
        borderRadius: "var(--site-radius-card)",
        backgroundColor:
          index % 2 === 0 ? "var(--site-primary)" : "var(--site-panel)",
      }}
    >
      {/* Screening a desaturated photo over the tint gives the mockup's duotone. */}
      <SitePicture
        image={priority.image}
        alt=""
        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
        className="absolute inset-0 size-full object-cover"
        style={{
          mixBlendMode: "screen",
          filter: "grayscale(1) contrast(1.05)",
          opacity: 0.52,
        }}
      />
      <div
        className="absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/50 group-focus-visible:bg-black/50"
        aria-hidden
      />

      <span
        className="absolute top-[22px] left-6 z-10 h-[1.5px] w-[60px] bg-white/90"
        aria-hidden
      />

      <div className="site-priority-body relative z-10 mt-auto flex flex-col px-6 pt-6 pb-5 md:absolute md:inset-x-6 md:bottom-5 md:mt-0 md:px-0 md:pt-0 md:pb-0">
        <h3 className="text-xl leading-[1.16] font-normal whitespace-normal text-white min-[640px]:text-2xl min-[768px]:whitespace-pre-line min-[1020px]:text-[clamp(1.125rem,1.7vw,1.875rem)]">
          {priority.title}
        </h3>
        <div className="grid min-h-0 grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <p className="pt-3 text-[1.1rem] leading-[1.45] text-white/90 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
              {priority.description}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Priorities() {
  return (
    <section className="bg-[var(--site-surface)]">
      <div className={SITE_COL}>
        <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-2 min-[1020px]:grid-cols-4">
          {priorities.map((priority, index) => (
            <PriorityCard key={priority.id} priority={priority} index={index} />
          ))}
        </div>
        {/* Sits against the right margin, still ranged left. */}
        <p className="mt-8 max-w-[32rem] text-lg leading-snug text-[var(--site-ink)]/85 md:mt-10 lg:mt-12 lg:ml-auto sm:text-[1.35rem]">
          {PRIORITIES_NOTE}
        </p>
      </div>
    </section>
  );
}
