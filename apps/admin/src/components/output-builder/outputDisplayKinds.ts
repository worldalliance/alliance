import type { DisplayKind } from "@alliance/common/forms/display-blocks";

export const OUTPUT_BY_KIND = {
  header: true,
  text: true,
  label: true,
  divider: true,
  spacer: true,
  html: true,
  images: true,
  quote: true,
  userLocation: true,
  video: false,
  biglink: false,
  copytext: false,
  previousAnswer: false,
  chatTranscript: false,
  accordion: false,
} as const satisfies Record<DisplayKind, boolean>;

export type OutputDisplayBlockKind = {
  [K in keyof typeof OUTPUT_BY_KIND]: (typeof OUTPUT_BY_KIND)[K] extends true
    ? K
    : never;
}[keyof typeof OUTPUT_BY_KIND];

const isOutputDisplayBlockKind = (
  kind: string,
): kind is OutputDisplayBlockKind =>
  Object.entries(OUTPUT_BY_KIND).some(
    ([allowedKind, allowed]) => allowed && allowedKind === kind,
  );

export const DISPLAY_BLOCK_KINDS = Object.keys(OUTPUT_BY_KIND).filter(
  isOutputDisplayBlockKind,
);
