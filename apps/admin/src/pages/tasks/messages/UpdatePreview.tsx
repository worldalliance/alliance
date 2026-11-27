import type { RecognitionCopy } from "@alliance/common/action-update-copy";
import type { RecognitionPreviewCountsDto } from "@alliance/shared/client";
import { escapeRegExp } from "es-toolkit";
import { countOf } from "../../../lib/formatNumber";
import {
  PREVIEW_PLACEHOLDERS,
  PREVIEW_VARIATION_LABELS,
  previewVariationCount,
  previewVariations,
  type CollectiveResultTexts,
} from "../../../lib/updatePreview";

export const UPDATE_PREVIEW_DESCRIPTION =
  "Every variation going out, as members will see it. Highlighted parts are filled in per member or from the update.";

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
      <mark key={index} className="rounded-sm bg-warning-soft px-0.5 text-fg">
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
    return <p className="text-warning">{variations.error}</p>;
  }
  const counted = counts?.kind === PreviewCountsKind.Counted && counts.counts;
  return (
    <div className="flex flex-col gap-3">
      {counts?.kind === PreviewCountsKind.Unavailable && (
        <p className="text-caption text-fg-muted">{counts.reason}</p>
      )}
      {variations.value.map(({ variation, copy }) => (
        <article
          key={variation}
          aria-label={PREVIEW_VARIATION_LABELS[variation]}
          className="rounded-md bg-surface-2 p-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">
              {PREVIEW_VARIATION_LABELS[variation]}
            </span>
            {counted ? (
              <span className="text-caption text-fg-muted tabular-nums">
                {countOf(previewVariationCount[variation](counted), "member")}
              </span>
            ) : (
              counts?.kind === PreviewCountsKind.Pending && (
                <span className="text-caption text-fg-muted">Counting…</span>
              )
            )}
          </div>
          {copy ? (
            <dl className="mt-2 flex flex-col gap-1">
              {CHANNELS.map(({ key, label }) => (
                <div key={key} className="flex gap-3">
                  <dt className="w-24 shrink-0 text-caption text-fg-muted">
                    {label}
                  </dt>
                  <dd className="whitespace-pre-wrap">
                    <Highlighted text={copy[key]} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-1 text-fg-muted">
              Not notified: this group&apos;s result is empty.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
