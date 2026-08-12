// Type-only, so this module stays loadable under `bun test`: importing
// react-native for real pulls in its untranspiled entry point.
import type { TextStyle, ViewStyle } from "react-native";

// Match sharedweb's 28px list offset. React Native cannot synchronously size a
// shared marker column, so a fixed 24dp column plus 4dp gap aligns bullets and
// two-digit numbers; wider markers expand only their own row.
const MD_MARKER_COLUMN = 24;
const MD_MARKER_GAP = 4;

export const MD_MARKER_STYLE = {
  marginLeft: 0,
  marginRight: MD_MARKER_GAP,
  textAlign: "right",
} satisfies TextStyle;

// Keep flex layout independent of the library's `any`-typed style bag, where a
// renamed key would otherwise fail silently.
export const MD_LIST_ROW_STYLE = { flexDirection: "row" } satisfies ViewStyle;
export const MD_LIST_CONTENT_STYLE = { flex: 1 } satisfies ViewStyle;

/**
 * The column is in unscaled dp while markers render at `fontSize * fontScale`,
 * so it scales by hand to stay in step with the OS text-size setting.
 */
export function markerColumnWidth(fontScale: number): number {
  return Math.round(MD_MARKER_COLUMN * fontScale);
}

export enum ListMarkerKind {
  Bullet = "bullet",
  Ordered = "ordered",
  None = "none",
}

export type ListMarker =
  | { kind: ListMarkerKind.Bullet; glyph: string }
  | { kind: ListMarkerKind.Ordered; glyph: string }
  | { kind: ListMarkerKind.None };

type ListItemNode = { index: number };
type ListItemParents = {
  type: string;
  attributes?: Record<string, unknown>;
}[];

// A literal bullet avoids the library's oversized, clipping iOS middle dot.
const BULLET_GLYPH = "•";
// Fixed rather than taken from the item's own markup, matching `list-decimal`
// on web, which renders a period whether the source wrote `1.` or `1)`.
const ORDERED_DELIMITER = ".";

/**
 * Classifies a `list_item` by its immediate parent. The library instead walks
 * the whole ancestor chain and checks for a bullet list first, so an ordered
 * list nested under a bullet list draws bullets. Markers match sharedweb at
 * every depth: `list-disc` on each ul, `list-decimal` on each ol.
 */
export function resolveListMarker(params: {
  node: ListItemNode;
  parent: ListItemParents;
}): ListMarker {
  const { node, parent } = params;
  const list = parent[0];

  if (list?.type === "ordered_list") {
    // markdown-it sets `start` only when the list does not begin at 1, and
    // hands over a number today. `attributes` is an untyped passthrough of the
    // token's attrs though, so parse rather than type-check: rejecting a
    // numeric string would silently renumber the list from 1.
    const start = Number.parseInt(String(list.attributes?.start), 10);
    const firstNumber = Number.isNaN(start) ? 1 : start;
    return {
      kind: ListMarkerKind.Ordered,
      glyph: `${firstNumber + node.index}${ORDERED_DELIMITER}`,
    };
  }

  if (list?.type === "bullet_list") {
    return { kind: ListMarkerKind.Bullet, glyph: BULLET_GLYPH };
  }

  return { kind: ListMarkerKind.None };
}
