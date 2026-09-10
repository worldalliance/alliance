/** Hours in a week, one cell each. */
export const HOURS = 168;

/**
 * The middle cell of a grid that many columns wide, which is where the fifteen
 * minutes are marked. Derived rather than a fixed fraction, which centred the
 * 12-column phone grid and left the 24-column one a quarter of the way across.
 *
 * With an even column count no cell straddles the exact centre, so the one
 * returned starts at the midpoint and sits half a cell right of it.
 */
export function spentIndex(columns: number): number {
  return Math.floor(HOURS / columns / 2) * columns + Math.floor(columns / 2);
}
