import { waitlistEmailToken } from "@alliance/common/waitlistEmail";
import type { WaitlistEmailPreviewDto } from "@alliance/shared/client/types.gen";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCount } from "../../lib/formatNumber";
import { skippedGroups } from "../../lib/waitlistEmail";
import Button, { ButtonVariant } from "../../ui/Button";
import { Banner, BannerTone } from "../../ui/templates/Banner";

/**
 * Who would get the email and who is skipped, what stops or should give
 * pause, and the email as one recipient at a time would get it.
 */
export function EmailPreview({
  preview,
  includeClaimed,
  problem,
  warnings,
  signupLink,
  onSample,
}: {
  preview: WaitlistEmailPreviewDto;
  includeClaimed: boolean;
  problem: string | null;
  warnings: string[];
  signupLink: boolean;
  onSample: (entryId: number) => void;
}) {
  const { sample, recipientIds } = preview;
  const skipped = skippedGroups({ preview, includeClaimed });
  const audience = `${formatCount(recipientIds.length)} of ${formatCount(preview.selected)} selected would get this email${
    skipped.length > 0
      ? `, skipping ${new Intl.ListFormat("en").format(skipped)}`
      : ""
  }.`;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">{audience}</p>
      {problem && (
        <Banner tone={BannerTone.Danger} inline>
          {problem}
        </Banner>
      )}
      {warnings.length > 0 && (
        <Banner tone={BannerTone.Warning} inline>
          <ul className="flex flex-col gap-1">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Banner>
      )}
      {sample && (
        <SampleEmail
          sample={sample}
          recipientIds={recipientIds}
          signupLink={signupLink}
          onSample={onSample}
        />
      )}
    </div>
  );
}

function SampleEmail({
  sample,
  recipientIds,
  signupLink,
  onSample,
}: {
  sample: NonNullable<WaitlistEmailPreviewDto["sample"]>;
  recipientIds: number[];
  signupLink: boolean;
  onSample: (entryId: number) => void;
}) {
  const index = recipientIds.indexOf(sample.entryId);
  const recipient = `${sample.name}${sample.email ? ` <${sample.email}>` : ""}`;

  return (
    <article
      aria-label="Sample email"
      className="flex flex-col overflow-hidden rounded-md border border-line bg-surface"
    >
      <header className="flex items-start gap-3 border-b border-line px-3 py-2">
        <dl className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-fg-muted">To</dt>
            <dd className="min-w-0 truncate" title={recipient}>
              {recipient}
            </dd>
          </div>
          {sample.html !== null && (
            <div className="flex gap-3">
              <dt className="w-14 shrink-0 text-fg-muted">Subject</dt>
              <dd className="min-w-0 font-semibold break-words">
                {sample.subject}
              </dd>
            </div>
          )}
        </dl>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            aria-label="Previous recipient"
            disabled={index <= 0}
            onClick={() => onSample(recipientIds[index - 1])}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          {index >= 0 && (
            <span className="text-caption text-fg-muted tabular-nums">
              {formatCount(index + 1)} of {formatCount(recipientIds.length)}
            </span>
          )}
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            aria-label="Next recipient"
            disabled={index < 0 || index >= recipientIds.length - 1}
            onClick={() => onSample(recipientIds[index + 1])}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </header>
      {sample.html === null ? (
        <div className="p-3">
          <Banner tone={BannerTone.Danger} inline>
            This recipient has no value for{" "}
            {sample.missing.map(waitlistEmailToken).join(", ")}.
          </Banner>
        </div>
      ) : (
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={sample.html}
          className="h-96 w-full bg-surface"
        />
      )}
      {signupLink && sample.html !== null && (
        <p className="border-t border-line px-3 py-2 text-caption text-fg-muted">
          The preview shows a sample signup link. Sending issues each recipient
          their own.
        </p>
      )}
    </article>
  );
}
