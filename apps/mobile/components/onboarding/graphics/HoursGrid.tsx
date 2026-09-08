import { HOURS, spentIndex } from "@alliance/shared/lib/hoursGrid";
import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import {
  HOURS_END_LABEL,
  HOURS_LEGEND_SPENT,
  HOURS_LEGEND_TOTAL,
  HOURS_START_LABEL,
} from "../../../lib/onboarding/content";
import { useOnboardingScale } from "../../../lib/onboarding/scale";
import Text from "../../system/Text";

/** A phone gets the squarer of the site's two arrangements of the same week. */
const COLUMNS = 12;

const ROWS = HOURS / COLUMNS;

const GAP = 3;

const SPENT_INDEX = spentIndex(COLUMNS);

/**
 * Cells pop in along a diagonal, so the week fills from the corner the way a
 * hand would sweep it, and the fifteen minutes land last.
 */
const WAVE_MS = 26;

const SPENT_DELAY_MS = (COLUMNS + ROWS) * WAVE_MS + 160;

function Swatch({ solid }: { solid: boolean }) {
  return (
    <View
      className={
        solid
          ? "size-3 rounded-[3px] bg-white"
          : "size-3 rounded-[3px] bg-white/25"
      }
    />
  );
}

function LegendRow({ solid, label }: { solid: boolean; label: string }) {
  const scale = useOnboardingScale();

  return (
    <View className="flex-row items-center gap-2">
      <Swatch solid={solid} />
      <Text className="text-white/85" style={{ fontSize: scale.caption }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * 168 cells, one per hour of the week. Nested rows of flexing cells rather
 * than a wrap, so the week stretches to the box on both axes the way the web's
 * grid does.
 */
export function HoursGrid() {
  const scale = useOnboardingScale();

  return (
    <View className="min-h-0 flex-1">
      <Text className="mb-2 text-white/85" style={{ fontSize: scale.caption }}>
        {HOURS_START_LABEL}
      </Text>

      <View className="min-h-0 flex-1" style={{ gap: GAP }}>
        {Array.from({ length: ROWS }, (_, row) => (
          <View
            key={row}
            className="min-h-0 flex-1 flex-row"
            style={{ gap: GAP }}
          >
            {Array.from({ length: COLUMNS }, (_, column) => {
              const i = row * COLUMNS + column;
              const edge = i === 0 || i === HOURS - 1;

              return (
                <Animated.View
                  key={column}
                  entering={ZoomIn.delay((column + row) * WAVE_MS)
                    .springify()
                    .damping(13)}
                  className="min-h-0 flex-1 justify-center rounded-[5px]"
                  style={{
                    backgroundColor: edge
                      ? "transparent"
                      : "rgba(255,255,255,0.22)",
                    borderWidth: edge ? 1.5 : 0,
                    borderColor: "#fff",
                  }}
                >
                  {i === SPENT_INDEX && (
                    <Animated.View
                      entering={ZoomIn.delay(SPENT_DELAY_MS)
                        .springify()
                        .damping(9)}
                      className="mx-px h-[24%] rounded-[2px] bg-white"
                    />
                  )}
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Against the grid, the way the arrival label is, with the legend below. */}
      <Text
        className="mt-2 self-end text-white/85"
        style={{ fontSize: scale.caption }}
      >
        {HOURS_END_LABEL}
      </Text>

      <View className="mt-3 gap-1">
        <LegendRow solid label={HOURS_LEGEND_SPENT} />
        <LegendRow solid={false} label={HOURS_LEGEND_TOTAL} />
      </View>
    </View>
  );
}
