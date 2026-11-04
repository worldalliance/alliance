import {
  readGroupResults,
  recognitionCopy,
  RecognitionGroup,
  type RecognitionCopy,
} from "@alliance/common/action-update-copy";
import { R, type Result } from "@alliance/common/result";
import type { RecognitionPreviewCountsDto } from "@alliance/shared/client";
import { mapValues } from "es-toolkit";

export const PREVIEW_PLACEHOLDERS = {
  name: "[name]",
  link: "[link]",
  project: "[project]",
  content: "[update content]",
} as const;

// Stand-ins Markdown leaves unescaped, swapped for the placeholders after.
const SENTINELS = {
  name: "Previewname",
  link: "https://preview.invalid/link",
  project: "Previewproject",
  content: "Previewcontent",
} as const;

const withPlaceholders = (text: string) =>
  (["name", "link", "project", "content"] as const).reduce(
    (filled, key) =>
      filled.replaceAll(SENTINELS[key], PREVIEW_PLACEHOLDERS[key]),
    text,
  );

export enum PreviewVariation {
  Completed = "completed",
  DidNotComplete = "did_not_complete",
}

export const PREVIEW_VARIATION_LABELS: Record<PreviewVariation, string> = {
  [PreviewVariation.Completed]: "Completed the action",
  [PreviewVariation.DidNotComplete]: "Didn't complete the action",
};

export const previewVariationCount: Record<
  PreviewVariation,
  (counts: RecognitionPreviewCountsDto) => number
> = {
  [PreviewVariation.Completed]: (counts) => counts.completed,
  [PreviewVariation.DidNotComplete]: (counts) =>
    counts.didNotComplete + counts.uninvolved,
};

export type CollectiveResultTexts = {
  shortNotifString: string;
  nonCompleterResult: string;
};

/** null where the variation's group is skipped. */
export type PreviewVariationCopy = {
  variation: PreviewVariation;
  copy: RecognitionCopy | null;
};

const copyOf = (allianceResult: string | null) =>
  allianceResult === null
    ? null
    : mapValues(
        recognitionCopy({
          allianceResult,
          recipientName: SENTINELS.name,
          link: SENTINELS.link,
          projectOrActionName: SENTINELS.project,
          content: SENTINELS.content,
        }),
        withPlaceholders,
      );

/** Every variation a send produces, with the per-member parts as placeholders. */
export function previewVariations(
  texts: CollectiveResultTexts,
): Result<PreviewVariationCopy[], string> {
  return R.map(
    readGroupResults({
      completed: texts.shortNotifString,
      didNotComplete: texts.nonCompleterResult,
    }),
    (results) => [
      {
        variation: PreviewVariation.Completed,
        copy: copyOf(results[RecognitionGroup.Completed]),
      },
      {
        variation: PreviewVariation.DidNotComplete,
        copy: copyOf(results[RecognitionGroup.DidNotComplete]),
      },
    ],
  );
}
