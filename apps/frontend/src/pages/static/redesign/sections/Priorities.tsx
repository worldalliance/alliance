import { cn } from "@alliance/shared/styles/util";
import {
  HERO_HEADLINE,
  HERO_SUBHEAD,
  PRIORITIES_NOTE,
  priorities,
} from "../content";
import { PRIORITY_TINTS, type RedesignTheme } from "../theme";
import { DisplayHeading, RD_COL } from "../ui";

/**
 * Negative margin as a share of its containing block, which has to be the
 * content column rather than the full-bleed section for the share to mean
 * anything. Works out to the top quarter of a card at each breakpoint, so that
 * much of the row rides onto whatever sits above it.
 */
const OVERLAP = "-mt-[27.6%] sm:-mt-[13.5%] lg:-mt-[6.7%]";

/**
 * Bottom padding for a section whose copy must stay clear of the overlapping
 * cards. It resolves against the full-bleed section rather than the column, so
 * it runs wider than the pull above; erring long only adds air.
 */
export const OVERLAP_CLEARANCE =
  "pb-[calc(29%+2rem)] sm:pb-[calc(14.4%+2.5rem)] lg:pb-[calc(7%+3.5rem)]";

function PriorityCard({
  index,
  ...priority
}: (typeof priorities)[number] & { index: number }) {
  return (
    <article
      tabIndex={0}
      className="group relative isolate aspect-[321/355] overflow-hidden focus:outline-none"
      style={{
        borderRadius: "var(--rd-radius-card)",
        backgroundColor: PRIORITY_TINTS[index % PRIORITY_TINTS.length],
      }}
    >
      {/* Screening a desaturated photo over the tint gives the mockup's duotone. */}
      <img
        src={priority.image}
        alt=""
        aria-hidden
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

      {/* The title rides up on hover to make room for the description. */}
      <div className="rd-priority-body absolute inset-x-6 bottom-5 z-10 flex flex-col top-[36%] transition-[top] duration-500 ease-out group-hover:top-[18%] group-focus-visible:top-[18%]">
        <h3 className="text-[1.75rem] leading-[1.16] font-normal whitespace-pre-line text-white sm:text-[2rem]">
          {priority.title}
        </h3>
        <div className="grid min-h-0 flex-1 grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <p className="pt-3 text-[0.82rem] leading-[1.45] text-white/90 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
              {priority.description}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Versions 4 and 5, whose heroes carry no headline, so the h1 lives here in the
 * Landing 2 layout of an oversized heading beside supporting copy.
 */
export function HeadlineIntro({ theme }: { theme: RedesignTheme }) {
  return (
    <section className="bg-[var(--rd-surface)]">
      <div
        className={cn(
          RD_COL,
          "grid gap-6 pt-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pt-10",
          OVERLAP_CLEARANCE,
        )}
      >
        <DisplayHeading theme={theme} as="h1" className="lg:text-[3.5rem]">
          {HERO_HEADLINE}
        </DisplayHeading>
        <p className="self-center text-lg leading-snug font-medium text-[var(--rd-ink)] sm:text-[1.4rem]">
          {HERO_SUBHEAD}
        </p>
      </div>
    </section>
  );
}

/**
 * The card row sits on the `surfaceAlt` band that runs into the next section,
 * pulled up so it overlaps whatever precedes it.
 */
export function Priorities({ showNote }: { showNote: boolean }) {
  return (
    // `flow-root` keeps the pulled-up row from dragging the band up with it.
    <section className="flow-root bg-[var(--rd-surface)]">
      <div className={cn(RD_COL, "relative")}>
        <div className={OVERLAP}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {priorities.map((priority, index) => (
              <PriorityCard key={priority.id} index={index} {...priority} />
            ))}
          </div>
        </div>
        {showNote && (
          // Sits against the right margin, still ranged left.
          <p className="rd-priorities-note mt-10 ml-auto max-w-[32rem] text-lg leading-snug text-[var(--rd-ink)]/85 sm:text-[1.35rem] lg:mt-12">
            {PRIORITIES_NOTE}
          </p>
        )}
      </div>
    </section>
  );
}
