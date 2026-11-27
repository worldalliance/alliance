import type { ReactNode } from "react";
import { cn } from "../cn";
import { SEQUENCE_SWATCH_CLASSES } from "./chartColor";

/** Names each series under its chart. A chart of one series named by its title needs none. */
export function ChartLegend({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 text-caption text-fg-muted">
      {children}
    </ul>
  );
}

export function LegendItem({
  swatch,
  children,
}: {
  /** A colour value, or the swatch itself when it is a pattern. */
  swatch: string | ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      {typeof swatch === "string" ? (
        <span
          aria-hidden="true"
          className="size-3 rounded-sm"
          style={{ backgroundColor: swatch }}
        />
      ) : (
        swatch
      )}
      {children}
    </li>
  );
}

/** The legend of marks coloured by `sequenceColor`: what its first and last steps stand for. */
export function SequenceLegend({ from, to }: { from: string; to: string }) {
  return (
    <p className="flex items-center gap-2 text-caption text-fg-muted">
      {from}
      <span aria-hidden="true" className="flex overflow-hidden rounded-sm">
        {SEQUENCE_SWATCH_CLASSES.map((step) => (
          <span key={step} className={cn("h-2 w-5", step)} />
        ))}
      </span>
      {to}
    </p>
  );
}
