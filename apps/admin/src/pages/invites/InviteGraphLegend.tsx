import { cn } from "../../ui/cn";

const NODES = [
  { label: "Member", swatch: "bg-line border-line-strong" },
  { label: "Campaign", swatch: "bg-cat-4-soft border-cat-4" },
  { label: "NONE: no attribution", swatch: "bg-surface-2 border-line-control" },
  { label: "Selected", swatch: "bg-transparent border-accent" },
];

const LINKS = [
  {
    label: "Up the chain: who led to the selection",
    line: "border-chart-2 border-dashed",
  },
  { label: "Down the chain: whom they invited", line: "border-chart-4" },
];

/** What the graph's shapes and tones mean. Arrows point from inviter to invited. */
export function GraphLegend() {
  return (
    <ul className="flex flex-col gap-2 px-card py-4 text-caption">
      {NODES.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("size-3 shrink-0 rounded-full border-2", item.swatch)}
          />
          {item.label}
        </li>
      ))}
      {LINKS.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("w-5 shrink-0 border-t-2", item.line)}
          />
          {item.label}
        </li>
      ))}
      <li className="text-fg-muted">Arrows point from inviter to invited.</li>
    </ul>
  );
}
