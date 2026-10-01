import {
  waitlistCreate,
  type CreateWaitlistEntryDto,
  type WaitlistReferralDto,
} from "@alliance/shared/client";
import {
  thrownRefusalMessage,
  thrownStatus,
} from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { isRefused } from "@alliance/shared/lib/retryQuery";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import type { FormEvent } from "react";
import { ACCOUNT_BUTTON } from "../../../onboarding/chrome";
import { SiteArrow } from "../../../site/ui";
import { useWaitlistReferral } from "./useWaitlist";
import { WaitlistConfirmation } from "./WaitlistConfirmation";
import { WAITLIST_FIELD } from "./waitlistStyles";

const SOCIAL_PROOF_THRESHOLD = 3;

const SUBMIT_FALLBACK = "Something went wrong. Please try again.";

function ReferralBanner({ referral }: { referral: WaitlistReferralDto }) {
  const { organization, inviterName } = referral;
  const inviter = inviterName ?? organization?.name;
  if (!inviter) return null;
  const counted =
    !inviterName &&
    organization &&
    organization.entryCount >= SOCIAL_PROOF_THRESHOLD;
  return (
    <p className="mb-3 flex items-center justify-center gap-x-2 text-base text-zinc-500 lg:text-white/85">
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
          <span className="font-medium text-black lg:text-white">
            {organization.name}
          </span>
        </span>
      ) : (
        <span>
          <span className="font-medium text-black lg:text-white">
            {inviter}
          </span>{" "}
          invited you to the Alliance
        </span>
      )}
    </p>
  );
}

/** A white card on narrow screens; from `lg` it sits straight on the primary band. */
export function WaitlistSignupForm({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const {
    codes,
    hasCode,
    query: referral,
    dropReferral,
  } = useWaitlistReferral();
  const submit = useMutation({
    mutationFn: (body: CreateWaitlistEntryDto) =>
      waitlistCreate({ body, throwOnError: true }).then((res) => res.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.waitlistCount() }),
  });

  const linkFailed =
    (hasCode && referral.isError && referral.data === undefined) ||
    thrownStatus(submit.error) === 404;
  const linkInactive =
    thrownStatus(submit.error) === 404 || isRefused(referral.error);
  const referralKnown = !hasCode || referral.data !== undefined;
  const needsReason = referralKnown && !referral.data?.organization;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit.mutate({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      reason: needsReason ? String(form.get("reason") ?? "") : undefined,
      committed: true,
      ...codes,
    });
  };

  const card = cn(
    "flex flex-col gap-3 bg-white p-5 text-[var(--site-ink)] sm:p-6 lg:bg-transparent lg:p-0 lg:text-white",
    className,
  );
  const cardStyle = { borderRadius: "var(--site-radius-card)" };

  if (submit.isSuccess) {
    return (
      <div className={card} style={cardStyle}>
        <WaitlistConfirmation shareCode={submit.data.shareCode} />
      </div>
    );
  }

  return (
    <form className={card} style={cardStyle} onSubmit={onSubmit}>
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
          <p className="mb-3 text-center text-base text-zinc-500 lg:text-white/85">
            Checking your invitation link…
          </p>
        )
      )}
      <input
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Full Name"
        aria-label="Full Name"
        required
        maxLength={200}
        className={WAITLIST_FIELD}
      />
      <input
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Email"
        aria-label="Email"
        required
        maxLength={320}
        className={WAITLIST_FIELD}
      />
      {needsReason && (
        <textarea
          name="reason"
          placeholder="Why do you want to join the Alliance?"
          aria-label="Why do you want to join the Alliance?"
          required
          maxLength={4000}
          rows={3}
          className={cn(WAITLIST_FIELD, "h-auto resize-y py-2.5")}
        />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          name="commit"
          type="checkbox"
          required
          className="accent-green size-4 shrink-0"
        />
        I commit to join the Alliance.
      </label>
      <Button
        type="submit"
        color={ButtonColor.Green}
        disabled={submit.isPending || !referralKnown || linkFailed}
        className={ACCOUNT_BUTTON}
      >
        {submit.isPending ? "Joining…" : "Join the Waitlist"}
        <SiteArrow className="size-2.5" />
      </Button>
      {submit.isError && !linkFailed && (
        <p className="text-sm text-red-600 lg:text-red-200" role="alert">
          {thrownRefusalMessage({
            error: submit.error,
            fallback: SUBMIT_FALLBACK,
            sessionExpired: SUBMIT_FALLBACK,
          })}
        </p>
      )}
      <p className="text-center text-sm text-zinc-600 lg:text-white/85">
        By signing up you agree to get updates.
      </p>
    </form>
  );
}
