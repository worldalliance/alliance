import { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { countOf, formatCount } from "../../lib/formatNumber";
import { useUserCityCountsAdmin } from "../../lib/useUserCityCountsAdmin";
import { chartColor, sequenceColor } from "../../ui/charts/chartColor";
import { SequenceLegend } from "../../ui/charts/ChartLegend";
import { Skeleton } from "../../ui/Skeleton";
import { ListContent } from "../../ui/templates/List";
import { OverviewGrid, Panel, PanelStat } from "../../ui/templates/Overview";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import { summarizeCityCounts } from "./mapRules";

const WIDTH = 960;
const HEIGHT = 480;
const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const TOP_REGIONS = 12;

/** Where members with an active contract live, by the city on their profile. */
export function MapView() {
  const cityCounts = useUserCityCountsAdmin();
  const summary = useMemo(
    () => summarizeCityCounts(cityCounts.data ?? []),
    [cityCounts.data],
  );
  const share = summary.outsideUsShare;
  return (
    <>
      <RefreshFailedBanner things="member locations" query={cityCounts} />
      <ListContent cards>
        <ContentState
          things="member locations"
          query={cityCounts}
          refreshBanner={false}
          skeleton={<Skeleton className="h-96 w-full rounded-card" />}
          empty={summary.total === 0}
          emptyTitle="No member locations yet"
          emptyDescription="Counts cover members with an active contract."
        >
          <OverviewGrid>
            <Panel
              title="Members by city"
              description="Active contracts"
              className="col-span-12 @4xl:col-span-8"
            >
              <div className="flex flex-col gap-3">
                <div className="overflow-hidden rounded-md bg-surface-2">
                  <ComposableMap
                    projection="geoMercator"
                    width={WIDTH}
                    height={HEIGHT}
                    className="h-auto w-full"
                    role="img"
                    aria-label={`Map of members by city: ${countOf(summary.points.length, "location")}. The top regions list beside it has the counts.`}
                  >
                    <Geographies geography={GEO_URL}>
                      {({
                        geographies,
                      }: {
                        geographies: { rsmKey: string }[];
                      }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={chartColor.grid}
                            stroke={chartColor.surface}
                            strokeWidth={0.4}
                          />
                        ))
                      }
                    </Geographies>
                    {summary.points.map((point) => (
                      <Marker
                        key={point.key}
                        coordinates={[point.lon, point.lat]}
                      >
                        <circle
                          r={4 + (point.count / summary.maxCount) * 10}
                          fill={sequenceColor(point.count / summary.maxCount)}
                          fillOpacity={0.85}
                          stroke={chartColor.surface}
                          strokeWidth={0.8}
                        />
                      </Marker>
                    ))}
                  </ComposableMap>
                </div>
                <SequenceLegend from="Fewer" to="More" />
              </div>
            </Panel>
            <div className="col-span-12 flex flex-col gap-section @4xl:col-span-4">
              <Panel title="Location coverage">
                <div className="grid grid-cols-2 gap-4">
                  <PanelStat
                    label="Members with an active contract"
                    value={formatCount(summary.total)}
                  />
                  <PanelStat
                    label="With a location"
                    value={formatCount(summary.withLocation)}
                  />
                  <PanelStat
                    label="Outside the US"
                    value={formatCount(summary.outsideUs)}
                  />
                  <PanelStat
                    label="Share outside the US"
                    value={
                      share === null ? "—" : `${(share * 100).toFixed(1)}%`
                    }
                    note="Of those with a location"
                  />
                  <PanelStat
                    label="Distinct locations"
                    value={formatCount(summary.points.length)}
                  />
                </div>
              </Panel>
              {summary.points.length > 0 && (
                <Panel title="Top regions" flush>
                  <ol>
                    {summary.points.slice(0, TOP_REGIONS).map((point) => (
                      <li
                        key={point.key}
                        className="flex items-center justify-between gap-3 border-b border-line px-card py-2 last:border-b-0"
                      >
                        <span className="truncate">{point.label}</span>
                        <span className="text-fg-muted tabular-nums">
                          {countOf(point.count, "member")}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Panel>
              )}
            </div>
          </OverviewGrid>
        </ContentState>
      </ListContent>
    </>
  );
}
