import { KORA_PROJECT_PATH, KORA_REVIEW_PATH } from "@alliance/common/kora";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../../lib/AuthContext";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { SITE_COL } from "../../../site/ui";
import { ACCOUNT_COPY, ONBOARDING_COPY } from "./copy";
import { KoraPageShell } from "./KoraPageShell";
import { KoraRiskOptOut } from "./KoraRiskOptOut";
import { useKoraParticipant } from "./useKoraParticipant";
import { setKoraPreferences, useKoraReview } from "./useKoraReview";

export function meta() {
  return socialPreviewMeta({
    title: "Your review settings — Safer Chatbots for Children",
    description: "Change which situations you review.",
    url: `${KORA_PROJECT_PATH}/account`,
  });
}

const OPTION =
  "flex cursor-pointer items-start gap-3 rounded border border-zinc-300 bg-white px-4 py-3 has-checked:border-[var(--site-primary)] has-checked:bg-zinc-50";

function Settings({
  initialOptOutRisks,
  initialExtendedOptIn,
  onSaved,
}: {
  initialOptOutRisks: string[];
  initialExtendedOptIn: boolean;
  onSaved: () => void;
}) {
  const [optOutRisks, setOptOutRisks] = useState(initialOptOutRisks);
  const [extendedOptIn, setExtendedOptIn] = useState(initialExtendedOptIn);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const edit = (apply: () => void) => {
    setSaved(false);
    apply();
  };

  const save = async () => {
    setSaving(true);
    setFailed(false);
    setSaved(false);
    try {
      await setKoraPreferences({ optOutRisks, extendedOptIn });
      setSaved(true);
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{ACCOUNT_COPY.risksHeading}</h2>
        <KoraRiskOptOut
          optOutRisks={optOutRisks}
          onChange={(risks) => edit(() => setOptOutRisks(risks))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {ACCOUNT_COPY.extendedHeading}
        </h2>
        <p className="text-zinc-700">{ONBOARDING_COPY.extendedBody}</p>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{ACCOUNT_COPY.extendedHeading}</legend>
          {[true, false].map((yes) => (
            <label key={String(yes)} className={OPTION}>
              <input
                type="radio"
                name="kora-extended"
                checked={extendedOptIn === yes}
                onChange={() => edit(() => setExtendedOptIn(yes))}
              />
              <span>
                {yes ? ONBOARDING_COPY.extendedYes : ONBOARDING_COPY.extendedNo}
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <div className="flex items-center gap-4">
        <Button
          color={ButtonColor.Black}
          className="px-6"
          disabled={saving}
          onClick={() => void save()}
        >
          {ACCOUNT_COPY.save}
        </Button>
        {saved && (
          <p role="status" className="text-zinc-600">
            {ACCOUNT_COPY.saved}
          </p>
        )}
        {failed && (
          <p role="alert" className="text-red-700">
            {ACCOUNT_COPY.saveFailed}
          </p>
        )}
      </div>
    </div>
  );
}

export default function KoraAccountPage() {
  const member = useAuth();
  const { query: participantQuery } = useKoraParticipant();
  const signedIn =
    member.isAuthenticated || Boolean(participantQuery.data?.participant);
  const review = useKoraReview(signedIn);

  const shell = (children: React.ReactNode, busy = false) => (
    <KoraPageShell busy={busy}>
      <div className={cn(SITE_COL, "flex max-w-2xl flex-col gap-6 py-10")}>
        {children}
      </div>
    </KoraPageShell>
  );

  if (member.loading || participantQuery.isPending) return shell(null, true);
  if (!signedIn) return <Navigate to={KORA_PROJECT_PATH} replace />;
  if (review.query.isPending) return shell(null, true);
  if (review.query.isError) {
    return shell(
      <p role="alert" className="text-red-700">
        {ACCOUNT_COPY.saveFailed}
      </p>,
    );
  }

  const state = review.query.data;
  return shell(
    <>
      <h1 className="text-2xl font-semibold">{ACCOUNT_COPY.heading}</h1>
      <p className="text-zinc-700">{ACCOUNT_COPY.lede}</p>
      <Settings
        key={state.reviewerId}
        initialOptOutRisks={state.optOutRisks}
        initialExtendedOptIn={state.extendedOptIn}
        onSaved={() => void review.refresh()}
      />
      <Link className="font-medium underline" to={KORA_REVIEW_PATH}>
        {ACCOUNT_COPY.backToReview}
      </Link>
    </>,
  );
}
