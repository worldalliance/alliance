import type {
  KoraDemographicsDto,
  KoraReviewStateDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useEffect, useRef, useState } from "react";
import { SITE_COL } from "../../../site/ui";
import { ONBOARDING_COPY } from "./copy";
import {
  EMPTY_DEMOGRAPHICS,
  KoraDemographicsForm,
} from "./KoraDemographicsForm";
import { KoraRiskOptOut } from "./KoraRiskOptOut";
import { setKoraOnboarding, setKoraPreferences } from "./useKoraReview";

enum Step {
  Demographics = "demographics",
  Risks = "risks",
  Extended = "extended",
  Consent = "consent",
  Warning = "warning",
  Instructions = "instructions",
}

const STEPS = Object.values(Step);

const HEADING: Record<Step, string> = {
  [Step.Demographics]: ONBOARDING_COPY.demographicsHeading,
  [Step.Risks]: ONBOARDING_COPY.risksHeading,
  [Step.Extended]: ONBOARDING_COPY.extendedHeading,
  [Step.Consent]: ONBOARDING_COPY.consentHeading,
  [Step.Warning]: ONBOARDING_COPY.warningHeading,
  [Step.Instructions]: ONBOARDING_COPY.instructionsHeading,
};

const resumeAt = (state: KoraReviewStateDto): Step => {
  if (state.onboarding.consentAt) return Step.Warning;
  if (state.onboarding.demographics) return Step.Risks;
  return Step.Demographics;
};

const HEADING_ID = "kora-onboarding-heading";

const OPTION =
  "flex cursor-pointer items-start gap-3 rounded border border-zinc-300 bg-white px-4 py-3 has-checked:border-[var(--site-primary)] has-checked:bg-zinc-50";

export function KoraOnboarding({
  state,
  onDone,
}: {
  state: KoraReviewStateDto;
  onDone: () => void;
}) {
  const [step, setStep] = useState(() => resumeAt(state));
  const [demographics, setDemographics] = useState<KoraDemographicsDto>(
    () => state.onboarding.demographics ?? EMPTY_DEMOGRAPHICS,
  );
  const [optOutRisks, setOptOutRisks] = useState(state.optOutRisks);
  const [extendedOptIn, setExtendedOptIn] = useState(state.extendedOptIn);
  const [consented, setConsented] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), [step]);

  const index = STEPS.indexOf(step);
  const go = async (save: () => Promise<unknown>, next: Step | null) => {
    setSaving(true);
    setFailed(false);
    try {
      await save();
      if (next) setStep(next);
      else onDone();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const body = () => {
    switch (step) {
      case Step.Demographics:
        return (
          <>
            <p className="text-zinc-700">{ONBOARDING_COPY.demographicsLede}</p>
            <KoraDemographicsForm
              value={demographics}
              onChange={setDemographics}
            />
            <Actions
              onContinue={() =>
                void go(() => setKoraOnboarding({ demographics }), Step.Risks)
              }
              saving={saving}
            />
          </>
        );
      case Step.Risks:
        return (
          <>
            <p className="text-zinc-700">{ONBOARDING_COPY.risksLede}</p>
            <KoraRiskOptOut
              optOutRisks={optOutRisks}
              onChange={setOptOutRisks}
            />
            <Actions
              onBack={() => setStep(Step.Demographics)}
              onContinue={() =>
                void go(
                  () => setKoraPreferences({ optOutRisks }),
                  Step.Extended,
                )
              }
              saving={saving}
            />
          </>
        );
      case Step.Extended:
        return (
          <>
            <p className="text-zinc-700">{ONBOARDING_COPY.extendedBody}</p>
            <p className="text-zinc-700">{ONBOARDING_COPY.extendedHarder}</p>
            <p className="text-zinc-700">{ONBOARDING_COPY.extendedChange}</p>
            <fieldset
              className="flex flex-col gap-2"
              aria-labelledby={HEADING_ID}
            >
              {[true, false].map((yes) => (
                <label key={String(yes)} className={OPTION}>
                  <input
                    type="radio"
                    name="kora-extended"
                    checked={extendedOptIn === yes}
                    onChange={() => setExtendedOptIn(yes)}
                  />
                  <span>
                    {yes
                      ? ONBOARDING_COPY.extendedYes
                      : ONBOARDING_COPY.extendedNo}
                  </span>
                </label>
              ))}
            </fieldset>
            <Actions
              onBack={() => setStep(Step.Risks)}
              onContinue={() =>
                void go(
                  () => setKoraPreferences({ extendedOptIn }),
                  Step.Consent,
                )
              }
              saving={saving}
            />
          </>
        );
      case Step.Consent:
        return (
          <>
            <ul className="flex list-disc flex-col gap-3 pl-5 text-zinc-700">
              {ONBOARDING_COPY.consentPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <label className={OPTION}>
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => {
                  setConsented(e.target.checked);
                  if (e.target.checked) setConsentMissing(false);
                }}
              />
              <span>{ONBOARDING_COPY.consentTick}</span>
            </label>
            {consentMissing && (
              <p role="alert" className="text-red-700">
                {ONBOARDING_COPY.consentNeeded}
              </p>
            )}
            <Actions
              onBack={() => setStep(Step.Extended)}
              continueLabel={ONBOARDING_COPY.consentContinue}
              onContinue={() => {
                if (!consented) return setConsentMissing(true);
                void go(
                  () => setKoraOnboarding({ consented: true }),
                  Step.Warning,
                );
              }}
              saving={saving}
            />
          </>
        );
      case Step.Warning:
        return (
          <>
            <p className="text-zinc-700">{ONBOARDING_COPY.warningBody}</p>
            <Actions
              onContinue={() => setStep(Step.Instructions)}
              saving={saving}
            />
          </>
        );
      case Step.Instructions:
        return (
          <>
            <p className="text-zinc-700">{ONBOARDING_COPY.instructionsIntro}</p>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-zinc-700">
              {ONBOARDING_COPY.instructionsSteps.map((item) => (
                <li key={item.title}>
                  <strong className="font-semibold">{item.title}</strong>{" "}
                  {item.body}
                </li>
              ))}
            </ol>
            <Section
              heading={ONBOARDING_COPY.instructionsGuideHeading}
              body={ONBOARDING_COPY.instructionsGuide}
            />
            <Section
              heading={ONBOARDING_COPY.instructionsRulesHeading}
              body={ONBOARDING_COPY.instructionsRules}
            />
            <Section
              heading={ONBOARDING_COPY.instructionsPracticeHeading}
              body={ONBOARDING_COPY.instructionsPractice}
            />
            <p className="text-zinc-700">
              {ONBOARDING_COPY.instructionsLeaving}
            </p>
            <Actions
              onBack={() => setStep(Step.Warning)}
              continueLabel={ONBOARDING_COPY.startReviewing}
              onContinue={() =>
                void go(() => setKoraOnboarding({ onboarded: true }), null)
              }
              saving={saving}
            />
          </>
        );
      default:
        throw new Error(`unknown step: ${step satisfies never}`);
    }
  };

  return (
    <div className={cn(SITE_COL, "flex max-w-2xl flex-col gap-6 py-10")}>
      <p className="text-sm text-zinc-600">
        {ONBOARDING_COPY.step(index + 1, STEPS.length)}
      </p>
      <h1
        id={HEADING_ID}
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-semibold outline-none"
      >
        {HEADING[step]}
      </h1>
      {body()}
      {failed && (
        <p role="alert" className="text-red-700">
          {ONBOARDING_COPY.saveFailed}
        </p>
      )}
    </div>
  );
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="font-semibold">{heading}</h2>
      <p className="text-zinc-700">{body}</p>
    </section>
  );
}

function Actions({
  onBack,
  onContinue,
  continueLabel = ONBOARDING_COPY.continue,
  saving,
}: {
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  saving: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button
        color={ButtonColor.Black}
        onClick={onContinue}
        disabled={saving}
        className="px-6"
      >
        {continueLabel}
      </Button>
      {onBack && (
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={onBack}
        >
          {ONBOARDING_COPY.back}
        </button>
      )}
    </div>
  );
}
