import type { NodeStyle } from "../../components/force-graph/ForceGraph";
import { chartColor, SERIES } from "../../ui/charts/chartColor";
import { NodeKind } from "./buildInviteGraph";

const token = (name: string) => `var(--color-${name})`;

export const NODE_RADIUS = 20;
const HUB_RADIUS = 14;

export const NODE_STYLE: Record<NodeKind, NodeStyle> = {
  [NodeKind.User]: {
    radius: NODE_RADIUS,
    fill: token("line"),
    stroke: token("line-strong"),
    strokeWidth: 1.5,
    glyph: () => "?",
    glyphFontSize: 16,
    glyphColor: token("fg-muted"),
    label: { color: token("fg"), weight: "normal" },
  },
  [NodeKind.Unattributed]: {
    radius: HUB_RADIUS,
    fill: token("surface-2"),
    stroke: token("line-control"),
    strokeWidth: 2,
    glyph: () => "NONE",
    glyphFontSize: 9,
    glyphColor: token("fg-muted"),
    label: null,
  },
  [NodeKind.Campaign]: {
    radius: NODE_RADIUS,
    fill: token("cat-4-soft"),
    stroke: token("cat-4"),
    strokeWidth: 2,
    glyph: (node) => node.displayName.charAt(0).toUpperCase(),
    glyphFontSize: 16,
    glyphColor: token("fg"),
    label: { color: token("fg"), weight: "bold" },
  },
};

export enum LinkTone {
  Plain = "plain",
  /** Between the selected member and someone they invited, directly or down the chain. */
  Descendant = "descendant",
  /** Between the selected member and whoever led to them, up the chain. */
  Ancestor = "ancestor",
}

export const SELECTED_STROKE = token("accent");

/**
 * The two lineage tones differ by more than hue: an ancestor link is dashed,
 * and every link's arrow points from the inviter to the invited.
 */
export const LINK_TONE: Record<
  LinkTone,
  { color: string; markerId: string; dash: string | null }
> = {
  [LinkTone.Plain]: {
    color: chartColor.track,
    markerId: "arrowhead",
    dash: null,
  },
  [LinkTone.Descendant]: {
    color: SERIES[3],
    markerId: "arrowhead-highlight",
    dash: null,
  },
  [LinkTone.Ancestor]: {
    color: SERIES[1],
    markerId: "arrowhead-ancestor",
    dash: "5 3",
  },
};
