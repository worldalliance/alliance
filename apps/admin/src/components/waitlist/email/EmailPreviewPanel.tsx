import { waitlistEmailToken } from "@alliance/common/waitlistEmail";
import type { WaitlistEmailPreviewDto } from "@alliance/shared/client/types.gen";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { skippedGroups } from "../../../lib/waitlistEmail";
import { ICON_BUTTON_CLASS } from "../controlClasses";

type EmailPreviewPanelProps = {
  preview: WaitlistEmailPreviewDto;
  includeClaimed: boolean;
  problem: string | null;
  warnings: string[];
  signupLink: boolean;
  onSample: (entryId: number) => void;
};

const EmailPreviewPanel: React.FC<EmailPreviewPanelProps> = ({
  preview,
  includeClaimed,
  problem,
  warnings,
  signupLink,
  onSample,
}) => {
  const { sample, recipientIds } = preview;
  const index = sample ? recipientIds.indexOf(sample.entryId) : -1;
  const skipped = skippedGroups({ preview, includeClaimed });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-zinc-700">
        {recipientIds.length} of {preview.selected} selected would get this
        email
        {skipped.length > 0 &&
          `, skipping ${new Intl.ListFormat("en").format(skipped)}`}
        .
      </p>
      {problem && <p className="text-red-600">{problem}</p>}
      {warnings.length > 0 && (
        <ul className="list-disc pl-5 text-amber-700">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {sample && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous recipient"
              title="Previous recipient"
              className={ICON_BUTTON_CLASS}
              disabled={index <= 0}
              onClick={() => onSample(recipientIds[index - 1])}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-zinc-700">
              {sample.name} &lt;{sample.email}&gt;
              {index >= 0 && ` · ${index + 1} of ${recipientIds.length}`}
            </span>
            <button
              type="button"
              aria-label="Next recipient"
              title="Next recipient"
              className={ICON_BUTTON_CLASS}
              disabled={index < 0 || index >= recipientIds.length - 1}
              onClick={() => onSample(recipientIds[index + 1])}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {sample.html === null ? (
            <p className="text-red-600">
              This recipient has no value for{" "}
              {sample.missing.map(waitlistEmailToken).join(", ")}.
            </p>
          ) : (
            <>
              <p className="font-medium text-zinc-900">{sample.subject}</p>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={sample.html}
                className="h-80 w-full rounded border border-zinc-200 bg-white"
              />
              {signupLink && (
                <p className="text-xs text-zinc-500">
                  The preview shows a sample signup link. Sending issues each
                  recipient their own.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailPreviewPanel;
