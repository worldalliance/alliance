import { hashString } from "../lib/identitySwatch";

// Literal class names, so Tailwind generates them.
const CATEGORIES = [
  {
    solid: "bg-cat-1",
    soft: "bg-cat-1-soft",
    border: "border-cat-1",
    value: "var(--color-cat-1)",
  },
  {
    solid: "bg-cat-2",
    soft: "bg-cat-2-soft",
    border: "border-cat-2",
    value: "var(--color-cat-2)",
  },
  {
    solid: "bg-cat-3",
    soft: "bg-cat-3-soft",
    border: "border-cat-3",
    value: "var(--color-cat-3)",
  },
  {
    solid: "bg-cat-4",
    soft: "bg-cat-4-soft",
    border: "border-cat-4",
    value: "var(--color-cat-4)",
  },
  {
    solid: "bg-cat-5",
    soft: "bg-cat-5-soft",
    border: "border-cat-5",
    value: "var(--color-cat-5)",
  },
  {
    solid: "bg-cat-6",
    soft: "bg-cat-6-soft",
    border: "border-cat-6",
    value: "var(--color-cat-6)",
  },
] as const;

export type ProjectColor = (typeof CATEGORIES)[number];

/**
 * A project's category colour, the same on every page: `solid`, `soft` and
 * `border` are classes, `value` is for an SVG `fill` or `stroke`. Text on
 * `soft` is `text-fg`; the colour itself is too light for text.
 */
export const projectColor = (projectId: number): ProjectColor =>
  CATEGORIES[hashString(String(projectId)) % CATEGORIES.length];
