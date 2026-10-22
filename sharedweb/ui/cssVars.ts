import type { CSSProperties } from "react";

/** A `style` value that may set custom properties, which `CSSProperties` bars. */
export type StyleWithVars = CSSProperties &
  Record<`--${string}`, string | number>;
