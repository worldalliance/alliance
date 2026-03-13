import React, { useEffect, useMemo, useState } from "react";
import { userCityCounts } from "@alliance/shared/client";
import type { UserCityCountDto } from "@alliance/shared/client/types.gen";
import Card from "@alliance/sharedweb/ui/Card";
import { CardStyle } from "@alliance/shared/styles/card";
import chroma from "chroma-js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore react-simple-maps types are provided via devDependency
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

type AggregatedPoint = {
  key: string;
  label: string;
  lat: number;
  lon: number;
  count: number;
};

const svgWidth = 960;
const svgHeight = 480;

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const MemberMapPage: React.FC = () => {
  const [cityCounts, setCityCounts] = useState<UserCityCountDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    userCityCounts()
      .then((resp) => {
        if (resp.data) {
          setCityCounts(resp.data);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load member contact info", err);
        setError("Unable to load member locations. Please try again later.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const aggregatedPoints: AggregatedPoint[] = useMemo(() => {
    const points: AggregatedPoint[] = [];

    cityCounts.forEach((row, index) => {
      if (row.latitude == null || row.longitude == null) {
        return;
      }

      const labelParts = [row.cityName, row.countryCode].filter(
        (part): part is string => !!part,
      );
      const label = labelParts.join(", ") || "Unknown location";
      const key =
        row.cityId != null ? `city-${row.cityId}` : `unknown-${index}`;

      points.push({
        key,
        label,
        lat: row.latitude,
        lon: row.longitude,
        count: row.count,
      });
    });

    return points.sort((a, b) => b.count - a.count);
  }, [cityCounts]);

  const membersWithLocation = useMemo(() => {
    return cityCounts
      .filter((row) => row.cityId != null)
      .reduce((sum, row) => sum + row.count, 0);
  }, [cityCounts]);

  const totalMembers = useMemo(
    () => cityCounts.reduce((sum, row) => sum + row.count, 0),
    [cityCounts],
  );

  const maxCount = useMemo(
    () =>
      aggregatedPoints.length
        ? Math.max(...aggregatedPoints.map((p) => p.count))
        : 0,
    [aggregatedPoints],
  );

  const colorScale = useMemo(() => {
    if (!maxCount) {
      return () => "#d4d4d8";
    }
    const scale = chroma
      .scale(["#fee2e2", "#f97316", "#b91c1c"])
      .domain([1, maxCount]);
    return (value: number) => scale(Math.max(1, value)).hex();
  }, [maxCount]);

  return (
    <div className="p-6 pt-20 flex flex-col gap-6 bg-zinc-50 min-h-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Member map</h1>
        <p className="text-sm text-zinc-600 max-w-2xl">
          A 2D world view showing where members are concentrated.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] items-start">
        <Card style={CardStyle.White}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-700">
                World member heatmap
              </p>
              {loading && (
                <p className="text-xs text-zinc-500">Loading locations…</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}
            {!loading && !aggregatedPoints.length && !error && (
              <p className="text-sm text-zinc-500">
                No member location data available yet.
              </p>
            )}
            <div className="w-full overflow-hidden rounded-lg border border-zinc-200 bg-slate-900">
              <ComposableMap
                projection="geoMercator"
                width={svgWidth}
                height={svgHeight}
                className="w-full h-[min(420px,60vh)]"
                style={{ background: "#1045e3" }}
              >
                <Geographies geography={geoUrl}>
                  {({ geographies }: { geographies: { rsmKey: string }[] }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#18a824"
                        stroke="#1045e3"
                        strokeWidth={0.4}
                      />
                    ))
                  }
                </Geographies>

                {aggregatedPoints.map((point) => {
                  const radius =
                    maxCount > 0 ? 4 + (point.count / maxCount) * 10 : 0;
                  const fill = colorScale(point.count);

                  return (
                    <Marker
                      key={point.key}
                      coordinates={[point.lon, point.lat]}
                    >
                      <circle
                        r={radius}
                        fill={fill}
                        fillOpacity={0.8}
                        stroke="#0b1120"
                        strokeOpacity={0.4}
                        strokeWidth={0.8}
                      />
                    </Marker>
                  );
                })}
              </ComposableMap>
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-white backdrop-blur">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-zinc-700 uppercase tracking-wide">
                    Intensity
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">Fewer</span>
                    <div className="h-2 w-32 rounded-full bg-linear-to-r from-rose-100 via-orange-400 to-rose-700" />
                    <span className="text-[11px] text-zinc-500">More</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card style={CardStyle.White}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-700">
                Location coverage
              </p>
              <p className="text-xs text-zinc-500">
                Summary of member locations across the world.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Members with location</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">
                  {membersWithLocation}
                </p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Total members</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">
                  {totalMembers}
                </p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 col-span-2">
                <p className="text-xs text-zinc-500">Distinct locations</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">
                  {aggregatedPoints.length}
                </p>
              </div>
            </div>

            {aggregatedPoints.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Top regions
                </p>
                <ul className="flex flex-col gap-1 max-h-96 overflow-y-auto pr-1">
                  {aggregatedPoints.slice(0, 12).map((point) => (
                    <li
                      key={point.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-zinc-700">{point.label}</span>
                      <span className="text-zinc-500">
                        {point.count} member
                        {point.count === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MemberMapPage;
