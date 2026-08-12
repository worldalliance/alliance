import React from "react";
import { TextStyle, View } from "react-native";
import type { ASTNode } from "react-native-markdown-display";
import {
  ListMarkerKind,
  markerColumnWidth,
  MD_LIST_CONTENT_STYLE,
  MD_LIST_ROW_STYLE,
  MD_MARKER_STYLE,
  resolveListMarker,
} from "./markdownListLayout";
import Text from "./system/Text";

/**
 * Replaces the library's `list_item` rule, which ignores a patched `list_item`
 * style and misclassifies the nesting described on {@link resolveListMarker}.
 */
export function renderListItem(params: {
  node: ASTNode;
  children: React.ReactNode;
  parent: ASTNode[];
  inheritedStyles: TextStyle;
  fontScale: number;
  marginTop: number;
}): React.ReactNode {
  const { node, children, parent, inheritedStyles, fontScale, marginTop } =
    params;

  const row = (inner: React.ReactNode) => (
    <View key={node.key} style={[MD_LIST_ROW_STYLE, { marginTop }]}>
      {inner}
    </View>
  );

  const markerRow = (marker: { glyph: string; accessible?: boolean }) =>
    row(
      <>
        <Text
          style={[
            inheritedStyles,
            MD_MARKER_STYLE,
            { minWidth: markerColumnWidth(fontScale) },
          ]}
          accessible={marker.accessible}
        >
          {marker.glyph}
        </Text>
        <View style={MD_LIST_CONTENT_STYLE}>{children}</View>
      </>,
    );

  const marker = resolveListMarker({ node, parent });

  switch (marker.kind) {
    case ListMarkerKind.Ordered:
      return markerRow({ glyph: marker.glyph });
    case ListMarkerKind.Bullet:
      return markerRow({ glyph: marker.glyph, accessible: false });
    case ListMarkerKind.None:
      return row(children);
    default:
      marker satisfies never;
      return row(children);
  }
}
