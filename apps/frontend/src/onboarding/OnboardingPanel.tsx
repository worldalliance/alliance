import type {
  ContractDto,
  ProfileDto,
  ReferrerProfileDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import type { StyleWithVars } from "@alliance/sharedweb/ui/cssVars";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { AgreementStep } from "./AgreementStep";
import { FooterNav, ProgressTrack, StepLayout } from "./chrome";
import {
  FILLED_SEGMENTS,
  OnboardingStep,
  PanelTone,
  STEP_EYEBROW,
  STEP_TONE,
  stepBefore,
} from "./flow";
import { GrantmakingCard } from "./GrantmakingCard";
import { JoinPhase, PANEL_FADE_MS } from "./joinPhase";
// import { MobileAppFooter, MobileAppStep } from "./MobileAppStep";
import {
  CommitmentStep,
  CommunityStep,
  MinutesStep,
  ScaleStep,
} from "./StorySteps";

const PANEL_STYLE: StyleWithVars = {
  "--ob-leave": `${PANEL_FADE_MS}ms`,
};

/** `--ob-tone-ink` is the colour the footer's white primary button letters in. */
const TONE_CLASS: Record<PanelTone, string> = {
  [PanelTone.Navy]: "bg-[var(--ob-navy)] [--ob-tone-ink:var(--ob-navy)]",
  [PanelTone.Green]: "bg-[var(--ob-green)] [--ob-tone-ink:var(--ob-green)]",
};

export function OnboardingPanel({
  step,
  skipPanelMorph,
  joinPhase,
  goBack,
  goNext,
  join,
  agreementSigned,
  submitting,
  latestContract,
  inviter,
  faces,
  memberCount,
  signedName,
  onSignedNameChange,
  error,
}: {
  step: OnboardingStep;
  skipPanelMorph: boolean;
  joinPhase: JoinPhase;
  goBack: () => void;
  goNext: () => void;
  join: () => void;
  agreementSigned: boolean;
  submitting: boolean;
  latestContract: ContractDto | null;
  inviter: ReferrerProfileDto | null;
  faces: ProfileDto[];
  memberCount: number | undefined;
  signedName: string;
  onSignedNameChange: (name: string) => void;
  error: string | null;
}) {
  const isAccount = step === OnboardingStep.Account;
  const filled = FILLED_SEGMENTS[step];

  const storyStep = (
    body: React.ReactNode,
    options?: { className?: string; fill?: boolean },
  ) => (
    <StepLayout
      eyebrow={STEP_EYEBROW[step]}
      className={options?.className}
      fill={options?.fill}
      footer={
        <FooterNav
          onBack={
            stepBefore(step) === OnboardingStep.Account ? undefined : goBack
          }
          onNext={goNext}
          nextLabel="Continue"
          index={4}
        />
      }
    >
      {body}
    </StepLayout>
  );

  const panelBody = () => {
    switch (step) {
      case OnboardingStep.Account:
        return <GrantmakingCard className="absolute inset-0 rounded-none" />;
      case OnboardingStep.Community:
        return storyStep(<CommunityStep />);
      case OnboardingStep.Commitment:
        // The deck scales itself into the space it is handed, which it only
        // has once the body stops growing to fit its contents.
        return storyStep(<CommitmentStep />, { fill: true });
      case OnboardingStep.Scale:
        return storyStep(<ScaleStep />);
      case OnboardingStep.Minutes:
        // The grid sizes itself off the height it is handed, which it only has
        // once the body stops growing to fit its contents.
        return storyStep(<MinutesStep />, { fill: true });
      case OnboardingStep.Agreement:
        return (
          <StepLayout
            eyebrow={STEP_EYEBROW[step]}
            className="[--ob-gap:var(--ob-gap-tight)]"
            footer={
              <FooterNav
                onBack={goBack}
                onNext={join}
                nextLabel="Join"
                nextDisabled={
                  !agreementSigned || submitting || joinPhase !== JoinPhase.Idle
                }
                loading={submitting}
                index={4}
              />
            }
          >
            {latestContract && latestContract.description.length > 0 ? (
              <AgreementStep
                contract={latestContract}
                inviter={inviter}
                faces={faces}
                signedCount={memberCount ?? 0}
                signedName={signedName}
                onSignedNameChange={onSignedNameChange}
                error={error}
                received={joinPhase !== JoinPhase.Idle}
              />
            ) : (
              <p
                className="text-center text-[length:var(--ob-body)] text-white"
                role="alert"
              >
                We couldn’t load the membership agreement. Please reload the
                page.
              </p>
            )}
          </StepLayout>
        );
      case OnboardingStep.MobileApp:
        // return (
        //   <StepLayout
        //     eyebrow={STEP_EYEBROW[step]}
        //     footer={<MobileAppFooter onContinue={enterPlatform} />}
        //   >
        //     <MobileAppStep />
        //   </StepLayout>
        // );
        return null;
      default:
        throw new Error(`unknown onboarding step: ${step satisfies never}`);
    }
  };

  return (
    <div
      className={cn(
        "ob-panel",
        zIndex.drawer,
        isAccount ? "ob-panel--intro hidden lg:block" : "ob-panel--full",
        skipPanelMorph && "ob-panel--instant",
        joinPhase === JoinPhase.Leaving && "ob-panel--leaving",
        TONE_CLASS[STEP_TONE[step]],
      )}
      style={PANEL_STYLE}
    >
      <div key={step} className="relative size-full">
        {panelBody()}
      </div>
      {filled > 0 && <ProgressTrack filled={filled} />}
    </div>
  );
}
