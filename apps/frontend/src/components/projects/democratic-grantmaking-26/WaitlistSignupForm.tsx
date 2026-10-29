import { GENERIC_FAILURE } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
import type { WaitlistReferralDto } from "@alliance/shared/client";
import {
  thrownRefusalMessage,
  thrownStatus,
} from "@alliance/shared/lib/hey-api";
import { isRefused } from "@alliance/shared/lib/retryQuery";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { RotateCw } from "lucide-react";
import { type FormEvent, type ReactNode } from "react";
import { href, Link } from "react-router";
import { ACCOUNT_BUTTON } from "../../../onboarding/chrome";
import { useInviteSession } from "../../../site/invite/InviteSession";
import { ContactInput, useContactField } from "../ContactInput";
import { PROJECT_FIELD } from "../fieldStyles";
import {
  useWaitlistBrowser,
  useWaitlistMailEnabled,
  useWaitlistReferral,
} from "./useWaitlist";
import { ForgetBrowser, RememberedInvite } from "./WaitlistBrowserMemory";
import { WaitlistConfirmation } from "./WaitlistConfirmation";
import { WaitlistNominations } from "./WaitlistNominations";

const SOCIAL_PROOF_THRESHOLD = 3;

function ReferralBanner({ referral }: { referral: WaitlistReferralDto }) {
  const { organization, inviterName } = referral;
  const inviter = inviterName ?? organization?.name;
  if (!inviter) return null;
  const counted =
    !inviterName &&
    organization &&
    organization.entryCount >= SOCIAL_PROOF_THRESHOLD;
  return (
    <p className="mb-3 flex items-center justify-center gap-x-2 text-base text-[var(--site-ink)]/70">
      {!inviterName && organization?.picture && (
        <AvatarProfile
          pfp={organization.picture}
          size="override"
          thumbnail
          alt=""
          className="size-6 shrink-0 rounded-[5px]"
        />
      )}
      {counted ? (
        <span>
          Join {organization.entryCount.toLocaleString("en-US")} others from{" "}
          <span className="font-medium text-[var(--site-ink)]">
            {organization.name}
          </span>
        </span>
      ) : (
        <span>
          <span className="font-medium text-[var(--site-ink)]">{inviter}</span>{" "}
          invited you to the Alliance
        </span>
      )}
    </p>
  );
}

export function WaitlistSignupForm({
  className,
  submitLabel = "Join the Alliance waitlist",
  note = (
    <>
      The Alliance is a global, invite-only community. We take 15-minute weekly
      actions on our web and mobile apps to improve the world.{" "}
      <Link to={href("/")} className="underline underline-offset-2">
        Learn more
      </Link>
    </>
  ),
}: {
  className?: string;
  submitLabel?: string;
  note?: ReactNode;
}) {
  const {
    codes,
    hasCode,
    query: referral,
    dropReferral,
  } = useWaitlistReferral();
  const mailEnabled = useWaitlistMailEnabled();
  const { query: browser, forget, join: submit } = useWaitlistBrowser();
  const { signupHref: inviteSignupHref } = useInviteSession();
  const contact = useContactField();
  // Until the browser state answers, a returning entrant's input would vanish
  // into their confirmation. An error falls through to a usable form.
  const restoring = browser.isPending;
  const remembered = browser.data?.entry ?? null;
  const browserMemory = (
    <>
      {inviteSignupHref && <RememberedInvite signupHref={inviteSignupHref} />}
      {(remembered || inviteSignupHref) && (
        <ForgetBrowser
          forget={forget}
          onForgotten={() => {
            submit.reset();
            contact.reset();
          }}
        />
      )}
    </>
  );

  const linkFailed =
    (hasCode && referral.isError && referral.data === undefined) ||
    thrownStatus(submit.error) === 404;
  const linkInactive =
    thrownStatus(submit.error) === 404 || isRefused(referral.error);
  const referralKnown = !hasCode || referral.data !== undefined;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = contact.parse();
    if (R.isFailure(parsed)) return;
    forget.reset();
    submit.mutate({
      name: String(form.get("name") ?? ""),
      ...parsed.value,
      ...codes,
    });
  };

  const card = cn("flex flex-col gap-2.5 text-[var(--site-ink)]", className);

  const confirmed = submit.isSuccess
    ? {
        shareCode: submit.data.shareCode,
        email: submit.variables.email ?? null,
        mobilized: false,
      }
    : remembered && {
        shareCode: remembered.shareCode,
        email: null,
        mobilized: remembered.mobilized,
      };
  if (confirmed) {
    return (
      <div className={card}>
        <WaitlistConfirmation {...confirmed} mailEnabled={mailEnabled} />
        {confirmed.shareCode && (
          <WaitlistNominations
            key={confirmed.shareCode}
            initialValue={remembered?.nonprofitNominations ?? null}
          />
        )}
        {browserMemory}
      </div>
    );
  }

  return (
    <form className={card} onSubmit={onSubmit}>
      {browserMemory}
      {linkFailed ? (
        <div
          role="alert"
          className="mb-3 flex flex-col items-center gap-2 text-center text-base"
        >
          <p className="flex items-center gap-1.5">
            {linkInactive
              ? "This invitation link is not active."
              : "We couldn’t check this invitation link."}
            {!linkInactive && (
              <button
                type="button"
                aria-label="Try again"
                title="Try again"
                onClick={() => void referral.refetch()}
                disabled={referral.isFetching}
              >
                <RotateCw className="size-4" aria-hidden />
              </button>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              submit.reset();
              dropReferral();
            }}
            className="font-medium underline underline-offset-2"
          >
            Continue without this link
          </button>
        </div>
      ) : referral.data ? (
        <ReferralBanner referral={referral.data} />
      ) : (
        hasCode && (
          <p className="mb-3 text-center text-base text-[var(--site-ink)]/70">
            Checking your invitation link…
          </p>
        )
      )}
      <input
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Full name"
        aria-label="Full name"
        required
        maxLength={200}
        disabled={restoring}
        className={PROJECT_FIELD}
      />
      <ContactInput {...contact.inputProps} disabled={restoring} />
      <Button
        type="submit"
        color={ButtonColor.Black}
        disabled={restoring || submit.isPending || !referralKnown || linkFailed}
        className={cn(ACCOUNT_BUTTON, "p-4 text-base sm:text-lg")}
      >
        {submit.isPending ? "Joining…" : submitLabel}
      </Button>
      {submit.isError && !linkFailed && (
        <p className="text-sm text-red-700" role="alert">
          {thrownRefusalMessage({
            error: submit.error,
            fallback: GENERIC_FAILURE,
            sessionExpired: GENERIC_FAILURE,
          })}
        </p>
      )}
      <p className="mt-2 text-center text-base text-[var(--site-ink)]/70">
        {note}
      </p>
    </form>
  );
}
