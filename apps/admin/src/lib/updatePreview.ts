import {
  readGroupResults,
  recognitionBody,
  RecognitionBranch,
  recognitionCopy,
  RecognitionGroup,
  type RecognitionCopy,
} from "@alliance/common/action-update-copy";
import { R, type Result } from "@alliance/common/result";
import type { RecognitionPreviewCountsDto } from "@alliance/shared/client";
import type { RecognitionMode } from "./actionUpdateDetails";

export const PREVIEW_PLACEHOLDERS = {
  contribution: "[contribution]",
  weeksAgo: "[N weeks ago]",
  name: "[name]",
  link: "[link]",
} as const;

export enum PreviewVariation {
  Completed = "completed",
  DidNotComplete = "did_not_complete",
  Uninvolved = "uninvolved",
  /** Every recipient but completers, while unsplit. */
  EveryoneElse = "everyone_else",
}

export const PREVIEW_VARIATION_LABELS: Record<PreviewVariation, string> = {
  [PreviewVariation.Completed]: "Completed the action",
  [PreviewVariation.DidNotComplete]: "Didn't complete the action",
  [PreviewVariation.Uninvolved]: "Away or not involved",
  [PreviewVariation.EveryoneElse]: "Everyone else",
};

export const previewVariationCount: Record<
  PreviewVariation,
  (counts: RecognitionPreviewCountsDto) => number
> = {
  [PreviewVariation.Completed]: (counts) => counts.completed,
  [PreviewVariation.DidNotComplete]: (counts) => counts.didNotComplete,
  [PreviewVariation.Uninvolved]: (counts) => counts.uninvolved,
  [PreviewVariation.EveryoneElse]: (counts) =>
    counts.didNotComplete + counts.uninvolved,
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

const collectiveCopy = (allianceResult: string | null) =>
  allianceResult === null
    ? null
    : recognitionCopy({
        message: { branch: RecognitionBranch.B, allianceResult },
        recipientName: PREVIEW_PLACEHOLDERS.name,
        link: PREVIEW_PLACEHOLDERS.link,
      });

/** Every variation a send produces, with the per-member parts as placeholders. */
export function previewVariations(params: {
  mode: RecognitionMode;
  texts: CollectiveResultTexts;
}): Result<PreviewVariationCopy[], string> {
  const { mode, texts } = params;
  return R.map(
    readGroupResults({
      split: texts.splitCollectiveResult,
      completed: texts.shortNotifString,
      didNotComplete: texts.nonCompleterResult,
      uninvolved: texts.uninvolvedResult,
    }),
    (results) => {
      const completed = results[RecognitionGroup.Completed];
      const personal: PreviewVariationCopy = {
        variation: PreviewVariation.Completed,
        copy:
          completed === null
            ? null
            : recognitionCopy({
                message: {
                  branch: RecognitionBranch.A,
                  ...recognitionBody({
                    mode,
                    contribution: PREVIEW_PLACEHOLDERS.contribution,
                    allianceResult: completed,
                    weeksAgoText: PREVIEW_PLACEHOLDERS.weeksAgo,
                  }),
                },
                recipientName: PREVIEW_PLACEHOLDERS.name,
                link: PREVIEW_PLACEHOLDERS.link,
              }),
      };
      if (!texts.splitCollectiveResult) {
        return [
          personal,
          {
            variation: PreviewVariation.EveryoneElse,
            copy: collectiveCopy(completed),
          },
        ];
      }
      return [
        personal,
        {
          variation: PreviewVariation.DidNotComplete,
          copy: collectiveCopy(results[RecognitionGroup.DidNotComplete]),
        },
        {
          variation: PreviewVariation.Uninvolved,
          copy: collectiveCopy(results[RecognitionGroup.Uninvolved]),
        },
      ];
    },
  );
}
