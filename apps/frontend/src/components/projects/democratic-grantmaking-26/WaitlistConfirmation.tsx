import { cn } from "@alliance/shared/styles/util";
import { copyOutcome, CopyOutcome } from "@alliance/sharedweb/lib/clipboard";
import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { personalShareUrl } from "./useWaitlist";
import { WaitlistLinkRequest } from "./WaitlistLinkRequest";
import { WAITLIST_FIELD } from "./waitlistStyles";

const COPY_ICON = <Copy className="size-5" aria-hidden />;

const copyFeedback: Record<CopyOutcome, { icon: ReactNode; error: boolean }> = {
  [CopyOutcome.Copied]: {
    icon: <Check className="size-5" aria-hidden />,
    error: false,
  },
  [CopyOutcome.Failed]: { icon: COPY_ICON, error: true },
};

export function WaitlistConfirmation({
  shareCode,
  email,
  mailEnabled,
  mobilized,
}: {
  shareCode: string | null;
  /** Null when the browser remembered the entry rather than submitting it. */
  email: string | null;
  mailEnabled: boolean;
  mobilized: boolean;
}) {
  const [copied, setCopied] = useState<CopyOutcome | null>(null);
  const url = shareCode && personalShareUrl(shareCode);

  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-2xl">
        <Check className="text-green size-6 shrink-0" aria-hidden />
        {mobilized ? "You’re invited to join" : "You’re on the waitlist"}
      </p>
      <p className="text-zinc-600 lg:text-white/85">
        {mobilized
          ? "We emailed you an invitation to join the Alliance."
          : "We’ll email you when you can join the Alliance."}
      </p>
      {url && (
        <>
          <p className="mt-2 font-medium">
            Invite others with your personal link
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              aria-label="Your personal link"
              onFocus={(e) => e.currentTarget.select()}
              className={cn(WAITLIST_FIELD, "min-w-0 flex-1")}
            />
            <button
              type="button"
              aria-label="Copy link"
              title="Copy link"
              onClick={async () => setCopied(await copyOutcome(url))}
              className="bg-green flex size-11 shrink-0 items-center justify-center rounded-md text-white hover:bg-[#4d8c1d]"
            >
              {copied ? copyFeedback[copied].icon : COPY_ICON}
            </button>
          </div>
          {copied && copyFeedback[copied].error && (
            <p className="text-sm text-red-600 lg:text-red-200" role="alert">
              Couldn’t copy the link. Select it and copy it yourself.
            </p>
          )}
        </>
      )}
      {!url && email && mailEnabled && <WaitlistLinkRequest email={email} />}
    </div>
  );
}
