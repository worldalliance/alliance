import {
  readGroupResults,
  recognitionCopy,
  RecognitionGroup,
  type RecognitionCopy,
} from "@alliance/common/action-update-copy";
import { R, type Result } from "@alliance/common/result";
import type { RecognitionPreviewCountsDto } from "@alliance/shared/client";

export const PREVIEW_PLACEHOLDERS = {
  name: "[name]",
  link: "[link]",
} as const;

export enum PreviewVariation {
  Completed = "completed",
  DidNotComplete = "did_not_complete",
  Uninvolved = "uninvolved",
  /** Every recipient, while unsplit. */
  Everyone = "everyone",
}

export const PREVIEW_VARIATION_LABELS: Record<PreviewVariation, string> = {
  [PreviewVariation.Completed]: "Completed the action",
  [PreviewVariation.DidNotComplete]: "Didn't complete the action",
  [PreviewVariation.Uninvolved]: "Away or not involved",
  [PreviewVariation.Everyone]: "Everyone",
};

export const previewVariationCount: Record<
  PreviewVariation,
  (counts: RecognitionPreviewCountsDto) => number
> = {
  [PreviewVariation.Completed]: (counts) => counts.completed,
  [PreviewVariation.DidNotComplete]: (counts) => counts.didNotComplete,
  [PreviewVariation.Uninvolved]: (counts) => counts.uninvolved,
  [PreviewVariation.Everyone]: (counts) =>
    counts.completed + counts.didNotComplete + counts.uninvolved,
};

export type CollectiveResultTexts = {
  shortNotifString: string;
  splitCollectiveResult: boolean;
  nonCompleterResult: string;
  uninvolvedResult: string;
};

/** null where the variation's group is skipped. */
export type PreviewVariationCopy = {
  variation: PreviewVariation;
  copy: RecognitionCopy | null;
};

const copyOf = (allianceResult: string | null) =>
  allianceResult === null
    ? null
    : recognitionCopy({
        allianceResult,
        recipientName: PREVIEW_PLACEHOLDERS.name,
        link: PREVIEW_PLACEHOLDERS.link,
      });

/** Every variation a send produces, with the per-member parts as placeholders. */
export function previewVariations(
  texts: CollectiveResultTexts,
): Result<PreviewVariationCopy[], string> {
  return R.map(
    readGroupResults({
      split: texts.splitCollectiveResult,
      completed: texts.shortNotifString,
      didNotComplete: texts.nonCompleterResult,
      uninvolved: texts.uninvolvedResult,
    }),
    (results) =>
      texts.splitCollectiveResult
        ? [
            {
              variation: PreviewVariation.Completed,
              copy: copyOf(results[RecognitionGroup.Completed]),
            },
            {
              variation: PreviewVariation.DidNotComplete,
              copy: copyOf(results[RecognitionGroup.DidNotComplete]),
            },
            {
              variation: PreviewVariation.Uninvolved,
              copy: copyOf(results[RecognitionGroup.Uninvolved]),
            },
          ]
        : [
            {
              variation: PreviewVariation.Everyone,
              copy: copyOf(results[RecognitionGroup.Completed]),
            },
          ],
  );
}
