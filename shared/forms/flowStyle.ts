/** The task flow's button treatments, drawn alike on web and mobile. */
export enum FlowButtonKind {
  Primary = "primary",
  Secondary = "secondary",
  /** The primary action on the green completion screen. */
  Inverse = "inverse",
  Icon = "icon",
}

/** A duration, with its easing curve as cubic-bezier control points. */
export type Motion = {
  durationMs: number;
  easing: readonly [number, number, number, number];
};

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

/** Durations and easing curves for every transition of the task flow. */
export const flowMotion = {
  /** The flow opening, sliding up. */
  expand: { durationMs: 350, easing: EASE_OUT_QUART },
  /** The flow closing, sliding down. */
  collapse: { durationMs: 200, easing: EASE_OUT_QUART },
  /** The completion screen turning back to the usual colours before the flow closes. */
  recolor: { durationMs: 200, easing: EASE_OUT_QUART },
  /** The progress bar filling as the member moves between screens. */
  progress: { durationMs: 200, easing: EASE_OUT_QUART },
} as const satisfies Record<string, Motion>;
