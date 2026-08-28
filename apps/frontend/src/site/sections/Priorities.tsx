import { PRIORITIES_NOTE, priorities, type Priority } from "../content";
import { SITE_COL } from "../ui";

function PriorityCard({
  priority,
  index,
}: {
  priority: Priority;
  index: number;
}) {
  return (
    <article
      tabIndex={0}
      className="group relative isolate flex aspect-auto min-h-[13.5rem] flex-col overflow-hidden focus:outline-none md:aspect-[5/4] md:min-h-0"
      style={{
        borderRadius: "var(--site-radius-card)",
        backgroundColor:
          index % 2 === 0 ? "var(--site-primary)" : "var(--site-panel)",
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

      <div className="site-priority-body relative z-10 mt-auto flex flex-col px-6 pt-6 pb-5 md:absolute md:inset-x-6 md:bottom-5 md:mt-0 md:px-0 md:pt-0 md:pb-0">
        <h3 className="text-xl sm:text-2xl lg:text-3xl leading-[1.16] font-normal whitespace-normal text-white md:whitespace-pre-line ">
          {priority.title}
        </h3>
        <div className="grid min-h-0 grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <p className="pt-3 text-base leading-[1.45] text-white/90 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
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
