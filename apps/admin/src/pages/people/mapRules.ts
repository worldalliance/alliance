import type { UserCityCountDto } from "@alliance/shared/client/types.gen";

export type CityPoint = {
  key: string;
  label: string;
  lat: number;
  lon: number;
  count: number;
};

/**
 * The map's marks and the coverage numbers. Every count is of members with an
 * active contract; a member with no city is in the row with no `cityId`.
 */
export function summarizeCityCounts(rows: readonly UserCityCountDto[]) {
  const points: CityPoint[] = rows
    .flatMap((row, index) =>
      row.latitude == null || row.longitude == null
        ? []
        : [
            {
              key:
                row.cityId != null ? `city-${row.cityId}` : `unknown-${index}`,
              label:
                [row.cityName, row.countryCode].filter(Boolean).join(", ") ||
                "Unknown location",
              lat: row.latitude,
              lon: row.longitude,
              count: row.count,
            },
          ],
    )
    .sort((a, b) => b.count - a.count);
  const sum = (kept: readonly UserCityCountDto[]) =>
    kept.reduce((total, row) => total + row.count, 0);
  const withLocation = sum(rows.filter((row) => row.cityId != null));
  const outsideUs = sum(
    rows.filter(
      (row) =>
        row.countryCode != null && row.countryCode.toUpperCase() !== "US",
    ),
  );
  return {
    points,
    total: sum(rows),
    withLocation,
    outsideUs,
    /** Of members with a location; null when none has one. */
    outsideUsShare: withLocation > 0 ? outsideUs / withLocation : null,
    maxCount: points.length ? Math.max(...points.map((p) => p.count)) : 0,
  };
}
