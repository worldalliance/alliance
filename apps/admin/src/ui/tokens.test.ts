import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type Oklch = [number, number, number];

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const tokens = new Map<string, Oklch>(
  [
    ...css.matchAll(/--color-([\w-]+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g),
  ].map(([, name, l, c, h]) => [name, [Number(l), Number(c), Number(h)]]),
);

function luminance([L, C, H]: Oklch): number {
  const hue = (H * Math.PI) / 180;
  const a = C * Math.cos(hue);
  const b = C * Math.sin(hue);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const [r, g, bl] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.min(1, Math.max(0, channel)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(foreground: string, background: string): number {
  const [fg, bg] = [foreground, background].map((name) => {
    const value = tokens.get(name);
    if (!value) throw new Error(`no oklch token --color-${name} in index.css`);
    return luminance(value);
  });
  const [lighter, darker] = fg > bg ? [fg, bg] : [bg, fg];
  return (lighter + 0.05) / (darker + 0.05);
}

const categories = [1, 2, 3, 4, 5, 6];
const rampSteps = [1, 2, 3, 4, 5, 6, 7];
const HEAT_LIGHT_STEPS = 5;

// WCAG 2.2 SC 1.4.3: 4.5:1 for text.
const textPairs: [string, string][] = [
  ["fg", "canvas"],
  ["fg", "surface"],
  ["fg", "surface-2"],
  ["fg-muted", "canvas"],
  ["fg-muted", "surface"],
  ["fg-muted", "surface-2"],
  ["fg-muted", "line"],
  ["accent", "surface"],
  ["accent", "canvas"],
  ["accent", "surface-2"],
  ["accent", "accent-soft"],
  ["accent-fg", "accent"],
  ["accent-fg", "accent-hover"],
  ["accent-fg", "fg"],
  ["on-primary", "primary"],
  ["on-primary", "primary-hover"],
  ["fg", "accent-soft"],
  ["fg-muted", "accent-soft"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
  ["info", "info-soft"],
  ["success", "surface"],
  ["warning", "surface"],
  ["danger", "surface"],
  ["info", "surface"],
  ["success", "canvas"],
  ["warning", "canvas"],
  ["danger", "canvas"],
  ["info", "canvas"],
  ["fg", "success-soft"],
  ["fg", "warning-soft"],
  ["fg", "danger-soft"],
  ["fg", "info-soft"],
  ["on-danger", "danger"],
  ["on-danger", "danger-hover"],
  ...categories.map((n): [string, string] => ["fg", `cat-${n}-soft`]),
  ...rampSteps.map((n): [string, string] => [
    n <= HEAT_LIGHT_STEPS ? "fg" : "accent-fg",
    `heat-${n}`,
  ]),
];

// WCAG 2.2 SC 1.4.11: 3:1 for the boundary of a control and for graphics.
const nonTextPairs: [string, string][] = [
  ["line-control", "surface"],
  ["line-control", "canvas"],
  ["line-control", "surface-2"],
  ["accent", "surface"],
  ["accent", "canvas"],
  ["primary", "surface"],
  ["primary", "canvas"],
  ...categories.map((n): [string, string] => [`cat-${n}`, "surface"]),
  ...categories.map((n): [string, string] => [`chart-${n}`, "surface"]),
  ...categories
    .slice(1)
    .map((n): [string, string] => [`chart-${n - 1}`, `chart-${n}`]),
  ...rampSteps.map((n): [string, string] => [`seq-${n}`, "surface"]),
];

describe("admin colour tokens", () => {
  test.each(textPairs)("%s text on %s is at least 4.5:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(nonTextPairs)("%s on %s is at least 3:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
