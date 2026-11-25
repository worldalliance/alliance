export function formatPct(value: number): string {
  return `${+value.toFixed(2)}%`;
}

export const formatRatioAsPct = (ratio: number) =>
  `${(ratio * 100).toFixed(2)}%`;
