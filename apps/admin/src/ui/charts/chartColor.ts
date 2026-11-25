const token = (name: string) => `var(--color-${name})`;

/** Token colours for the parts of a chart that aren't a series. SVG marks take a value, not a class. */
export const chartColor = {
  grid: token("line"),
  cursor: token("fg-muted"),
  /** The whole a filled part is measured against: a bar's full length. */
  track: token("line-strong"),
  /** A line that is context for the one that matters. */
  muted: token("line-control"),
  surface: token("surface"),
} as const;

/**
 * Series colours, in the order to hand them out. Neighbours alternate dark and
 * light, so two series beside each other differ without their hue.
 */
export const SERIES = [
  token("chart-1"),
  token("chart-2"),
  token("chart-3"),
  token("chart-4"),
  token("chart-5"),
  token("chart-6"),
] as const;

const SEQUENCE = [
  token("seq-1"),
  token("seq-2"),
  token("seq-3"),
  token("seq-4"),
  token("seq-5"),
  token("seq-6"),
  token("seq-7"),
] as const;

export const SEQUENCE_SWATCH_CLASSES = [
  "bg-seq-1",
  "bg-seq-2",
  "bg-seq-3",
  "bg-seq-4",
  "bg-seq-5",
  "bg-seq-6",
  "bg-seq-7",
] as const;

const HEAT_CELL_CLASSES = [
  "bg-heat-1 text-fg",
  "bg-heat-2 text-fg",
  "bg-heat-3 text-fg",
  "bg-heat-4 text-fg",
  "bg-heat-5 text-fg",
  "bg-heat-6 text-accent-fg",
  "bg-heat-7 text-accent-fg",
] as const;

const stepOf = (share: number, steps: number) =>
  Math.min(steps - 1, Math.max(0, Math.floor(share * steps)));

/** A mark's colour by its place in an order, 0 (first, lightest) to 1 (last, darkest). */
export const sequenceColor = (share: number) =>
  SEQUENCE[stepOf(share, SEQUENCE.length)];

/** The classes of a filled cell holding a value from 0 (low) to 1 (high): its fill and a text colour that reads on it. */
export const heatCellClass = (share: number) =>
  HEAT_CELL_CLASSES[stepOf(share, HEAT_CELL_CLASSES.length)];

export const axisTextClass = "fill-fg-muted text-xs";
