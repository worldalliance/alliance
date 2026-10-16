import {
  DEFAULT_PHONE_COUNTRY,
  internationalPhoneCountry,
  type CountryCode,
} from "@alliance/common/phone";
import { R } from "@alliance/common/result";
// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
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
import { useState, type FormEvent } from "react";
import { ACCOUNT_BUTTON } from "../../../onboarding/chrome";
import { useInviteSession } from "../../../site/invite/InviteSession";
import {
  useWaitlistBrowser,
  useWaitlistMailEnabled,
  useWaitlistReferral,
} from "./useWaitlist";
import { ForgetBrowser, RememberedInvite } from "./WaitlistBrowserMemory";
import { WaitlistConfirmation } from "./WaitlistConfirmation";
import {
  parseWaitlistContact,
  WaitlistContactInput,
} from "./WaitlistContactInput";
import { WaitlistNominations } from "./WaitlistNominations";
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

export function WaitlistSignupForm({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const {
    codes,
    hasCode,
    query: referral,
    dropReferral,
  } = useWaitlistReferral();
  const mailEnabled = useWaitlistMailEnabled();
  const { query: browser, forget } = useWaitlistBrowser();
  const { signupHref: inviteSignupHref } = useInviteSession();
  const [contact, setContact] = useState("");
  const [country, setCountry] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [contactError, setContactError] = useState<string | null>(null);
  const blurError = (inCountry: CountryCode) => {
    const parsed = parseWaitlistContact(contact, inCountry);
    return contact.trim() && R.isFailure(parsed) ? parsed.error : null;
  };
  const submit = useMutation({
    mutationFn: (body: CreateWaitlistEntryDto) =>
      waitlistCreate({ body, throwOnError: true }).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistBrowser(),
      });
      return queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistCount(),
      });
    },
  });
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
            setContact("");
            setCountry(DEFAULT_PHONE_COUNTRY);
            setContactError(null);
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
    const parsed = parseWaitlistContact(contact, country);
    if (R.isFailure(parsed)) {
      setContactError(parsed.error);
      return;
    }
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
        className={WAITLIST_FIELD}
      />
      <WaitlistContactInput
        value={contact}
        onChange={(next) => {
          setContact(next);
          setContactError(null);
          const typed = internationalPhoneCountry(next);
          if (typed) setCountry(typed);
        }}
        country={country}
        onCountryChange={(next) => {
          setCountry(next);
          if (contactError) setContactError(blurError(next));
        }}
        error={contactError}
        onBlur={() => setContactError(blurError(country))}
        disabled={restoring}
      />
      <Button
        type="submit"
        color={ButtonColor.Black}
        disabled={restoring || submit.isPending || !referralKnown || linkFailed}
        className={cn(ACCOUNT_BUTTON, "p-4 text-base sm:text-lg")}
      >
        {submit.isPending ? "Joining…" : "Join the Alliance waitlist"}
      </Button>
      {submit.isError && !linkFailed && (
        <p className="text-sm text-red-700" role="alert">
          {thrownRefusalMessage({
            error: submit.error,
            fallback: SUBMIT_FALLBACK,
            sessionExpired: SUBMIT_FALLBACK,
          })}
        </p>
      )}
      <p className="text-center text-base text-[var(--site-ink)]/70">
        When we&apos;re ready, we&apos;ll send you an invite link.
      </p>
    </form>
  );
}
