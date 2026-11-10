import { cn } from "@alliance/shared/styles/util";
import { CLOSED_HEADING, CLOSED_MESSAGE } from "./copy";

export function KoraClosedNotice({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="kora-closed"
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-6",
        className,
      )}
    >
      <h2 id="kora-closed" className="text-xl font-medium sm:text-2xl">
        {CLOSED_HEADING}
      </h2>
      <p className="text-zinc-700">{CLOSED_MESSAGE}</p>
    </section>
  );
}
