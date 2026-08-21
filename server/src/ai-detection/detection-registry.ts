import { DetectableEntity } from "./entities/ai-detection-result.entity";

export interface DetectedField {
  fieldPath: string;
  text: string;
}

export interface DetectableFieldConfig<T = unknown> {
  entityType: DetectableEntity;
  extractText: (entity: T) => DetectedField[];
}

const MIN_DETECTION_WORDS = 75;

const wordCount = (value: string): number =>
  value
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

const isLongEnoughForDetection = (value: string): boolean =>
  wordCount(value) >= MIN_DETECTION_WORDS;

export const DETECTION_REGISTRY: DetectableFieldConfig[] = [
  {
    entityType: DetectableEntity.Comment,
    extractText: (comment: { editableContent?: { body?: unknown } }) => {
      const body = comment?.editableContent?.body;
      if (typeof body !== "string") {
        return [];
      }
      const trimmedBody = body.trim();
      if (!trimmedBody || !isLongEnoughForDetection(trimmedBody)) {
        return [];
      }
      return [
        {
          fieldPath: "editableContent.body",
          text: trimmedBody,
        },
      ];
    },
  },
  {
    entityType: DetectableEntity.FormResponse,
    extractText: (response: {
      answers?: Record<string, unknown>;
      skipAiDetection?: boolean;
    }) =>
      response.skipAiDetection
        ? []
        : Object.entries(response.answers ?? {})
            .filter(
              ([, value]) =>
                typeof value === "string" &&
                isLongEnoughForDetection(value.trim()),
            )
            .map(([key, value]: [string, string]) => ({
              fieldPath: `answers.${key}`,
              text: value.trim(),
            })),
  },
];
