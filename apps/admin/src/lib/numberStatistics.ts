import { type FormResponseFilter } from "./responseFilter";

export type StatRow = {
  key: string;
  label: string;
  count: number;
  useMarkdown?: boolean;
  filter?: FormResponseFilter;
};

export type NumberSummary = {
  min: number;
  max: number;
  avg: number;
  median: number;
  total: number;
};

export const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(2);
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
};

export const buildNumberStats = (
  values: number[],
  totalResponses: number,
): { rows: StatRow[]; answeredCount: number; summary?: NumberSummary } => {
  if (values.length === 0) {
    const rows =
      totalResponses > 0
        ? [
            {
              key: "no-response",
              label: "No response",
              count: totalResponses,
            },
          ]
        : [];
    return { rows, answeredCount: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const answeredCount = sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / answeredCount;
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint];

  const total = sum;

  if (min === max) {
    const rows: StatRow[] = [
      {
        key: "single-value",
        label: formatNumber(min),
        count: answeredCount,
      },
    ];
    if (answeredCount < totalResponses) {
      rows.unshift({
        key: "no-response",
        label: "No response",
        count: totalResponses - answeredCount,
      });
    }
    return { rows, answeredCount, summary: { min, max, avg, median, total } };
  }

  const shouldUseIntegerBuckets = sorted.every((value) =>
    Number.isInteger(value),
  );

  if (shouldUseIntegerBuckets) {
    const counts = new Map<number, number>();
    sorted.forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });

    const rows: StatRow[] = Array.from(counts.entries())
      .sort(([a], [b]) => a - b)
      .map(([value, count]) => ({
        key: `int-${value}`,
        label: String(value),
        count,
      }));

    if (answeredCount < totalResponses) {
      rows.unshift({
        key: "no-response",
        label: "No response",
        count: totalResponses - answeredCount,
      });
    }

    return {
      rows,
      answeredCount,
      summary: { min, max, avg, median, total },
    };
  }

  const desiredBins = Math.ceil(Math.sqrt(sorted.length));
  const binCount = Math.min(8, Math.max(3, desiredBins));
  const span = max - min;
  const step = span / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + index * step,
    end: index === binCount - 1 ? max : min + (index + 1) * step,
    count: 0,
  }));

  sorted.forEach((value) => {
    const index = Math.min(binCount - 1, Math.floor((value - min) / step));
    bins[index].count += 1;
  });

  const rows = bins.map((bin, index) => ({
    key: `bin-${index}`,
    label: `${formatNumber(bin.start)} - ${formatNumber(bin.end)}`,
    count: bin.count,
  }));

  if (answeredCount < totalResponses) {
    rows.unshift({
      key: "no-response",
      label: "No response",
      count: totalResponses - answeredCount,
    });
  }

  return {
    rows,
    answeredCount,
    summary: { min, max, avg, median, total },
  };
};
