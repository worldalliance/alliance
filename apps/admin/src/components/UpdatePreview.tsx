import type { RecognitionCopy } from "@alliance/common/action-update-copy";
import { withCount } from "@alliance/common/plural";
import type { RecognitionPreviewCountsDto } from "@alliance/shared/client";
import { escapeRegExp } from "es-toolkit";
import {
  PREVIEW_PLACEHOLDERS,
  PREVIEW_VARIATION_LABELS,
  previewVariationCount,
  previewVariations,
  type CollectiveResultTexts,
} from "../lib/updatePreview";

export const UPDATE_PREVIEW_DESCRIPTION =
  "Every variation going out, as members will see it. Highlighted parts differ per member.";

export enum PreviewCountsKind {
  Counted = "counted",
  Pending = "pending",
  Unavailable = "unavailable",
}

export type PreviewCounts =
  | { kind: PreviewCountsKind.Counted; counts: RecognitionPreviewCountsDto }
  | { kind: PreviewCountsKind.Pending }
  | { kind: PreviewCountsKind.Unavailable; reason: string };

const CHANNELS: { key: keyof RecognitionCopy; label: string }[] = [
  { key: "inApp", label: "In-app" },
  { key: "push", label: "Push" },
  { key: "sms", label: "Text" },
  { key: "emailSubject", label: "Email subject" },
  { key: "emailBody", label: "Email body" },
];

const PLACEHOLDERS = new Set<string>(Object.values(PREVIEW_PLACEHOLDERS));
const PLACEHOLDER_PATTERN = new RegExp(
  `(${[...PLACEHOLDERS].map(escapeRegExp).join("|")})`,
);

function Highlighted({ text }: { text: string }) {
  return text.split(PLACEHOLDER_PATTERN).map((part, index) =>
    PLACEHOLDERS.has(part) ? (
      <mark key={index} className="rounded bg-amber-100 px-0.5 text-amber-900">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function UpdatePreview({
  texts,
  counts,
}: {
  texts: CollectiveResultTexts;
  /** Omitted where there's no audience to count. */
  counts?: PreviewCounts;
}) {
  const variations = previewVariations(texts);
  if (!variations.ok) {
    return <p className="text-sm text-amber-700">{variations.error}</p>;
  }
  const counted = counts?.kind === PreviewCountsKind.Counted && counts.counts;
  return (
    <div className="space-y-3">
      {counts?.kind === PreviewCountsKind.Unavailable && (
        <p className="text-xs text-gray-500">{counts.reason}</p>
      )}
      {variations.value.map(({ variation, copy }) => (
        <div
          key={variation}
          className="rounded-md border border-gray-200 bg-white p-3 text-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-gray-900">
              {PREVIEW_VARIATION_LABELS[variation]}
            </span>
            {counted ? (
              <span className="text-xs text-gray-500">
                {withCount(previewVariationCount[variation](counted), "member")}
              </span>
            ) : (
              counts?.kind === PreviewCountsKind.Pending && (
                <span className="text-xs text-gray-400">Counting…</span>
              )
            )}
          </div>
          {copy ? (
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
              {CHANNELS.map(({ key, label }) => (
                <div key={key} className="contents">
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="whitespace-pre-wrap text-gray-800">
                    <Highlighted text={copy[key]} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-1 text-gray-500">
              Not notified: this group&apos;s result is empty.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
