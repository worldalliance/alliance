import { AnalyticsEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
import {
  authForgotPassword,
  authRegister,
  contractGetCurrent,
  contractSignContract,
} from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { forgotPassword as forgotPasswordCopy } from "@alliance/shared/lib/copy";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useInvite } from "@alliance/shared/lib/useInvite";
import { useSignupFaces } from "@alliance/shared/lib/useSignupFaces";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { AgreementStep } from "../../components/onboarding/AgreementStep";
import {
  FooterNav,
  ProgressTrack,
  StepLayout,
} from "../../components/onboarding/chrome";
import {
  CommitmentStep,
  COMMUNITY_REVEAL,
  CommunityStep,
  MinutesStep,
  ScaleStep,
} from "../../components/onboarding/StorySteps";
import { WelcomeGate } from "../../components/onboarding/WelcomeGate";
import Text from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { isCommitted } from "../../lib/onboarding/content";
import {
  AccountMode,
  FILLED_SEGMENTS,
  isOnboardingStep,
  OnboardingStep,
  PanelTone,
  STEP_EYEBROW,
  STEP_TONE,
  stepAfter,
  stepBefore,
} from "../../lib/onboarding/flow";
import {
  onboardingColors,
  useOnboardingScale,
} from "../../lib/onboarding/scale";
import { walkthroughStart } from "../../lib/onboarding/walkthroughSteps";

const TONE_BACKGROUND: Record<PanelTone, string> = {
  [PanelTone.Navy]: onboardingColors.navy,
  [PanelTone.Photo]: onboardingColors.photoWash,
};

/** The colour the footer's white primary button letters in. */
const TONE_INK: Record<PanelTone, string> = {
  [PanelTone.Navy]: onboardingColors.navy,
  [PanelTone.Photo]: onboardingColors.panelGreen,
};

const OnboardingScreen = () => {
  const router = useRouter();
  const scale = useOnboardingScale();
  const { login } = useAuth();
  const { ref: referralCode, step: stepParam } = useLocalSearchParams<{
    ref?: string;
    step?: string;
  }>();

  // `?step=` opens any screen without registering, so the later ones can be
  // reviewed while sign-up is invite-only. Development builds only.
  const [step, setStep] = useState(
    __DEV__ && isOnboardingStep(stepParam) ? stepParam : OnboardingStep.Account,
  );
  // Nobody installs the app before they have an account, so the welcome
  // screen opens on log in and hands straight over to the walkthrough. The
  // sign-up narrative behind it stays reachable for when that changes.
  const [accountMode, setAccountMode] = useState(AccountMode.LogIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [committed, setCommitted] = useState("");
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [received, setReceived] = useState(false);
  const registeredRef = useRef(false);

  const { data: memberCount } = useAllianceMemberCount();
  const faces = useSignupFaces(referralCode ?? null, {
    enabled: step === OnboardingStep.Agreement,
  });

  // No placeholder contract: the app-wide five-minute `staleTime` would treat
  // one as fresh and never fetch the real agreement.
  const { data: latestContract, isPending: contractPending } = useQuery({
    queryKey: ["contractGetCurrent"],
    queryFn: () => contractGetCurrent().then((res) => res.data ?? null),
  });

  const { used: inviteUsed, inviter } = useInvite(referralCode ?? null);

  useEffect(() => {
    if (!referralCode) return;
    captureEvent(AnalyticsEvent.InvitePageOpened, {
      referral_code: referralCode,
    });
  }, [referralCode]);

  const enterPlatform = useCallback(() => {
    router.replace(walkthroughStart());
  }, [router]);

  const goNext = useCallback(() => {
    const next = stepAfter(step);
    if (next) setStep(next);
  }, [step]);

  const goBack = useCallback(() => {
    const previous = stepBefore(step);
    if (previous) setStep(previous);
  }, [step]);

  /** A returning member skips the story and lands straight in the walkthrough. */
  const submitAccount = useCallback(async () => {
    setError(null);
    setNotice(null);

    if (accountMode === AccountMode.SignUp) {
      if (inviteUsed) return;
      goNext();
      return;
    }

    setSubmitting(true);
    try {
      await login({ email, password, navigateOnSuccess: false });
      enterPlatform();
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }, [accountMode, email, password, login, goNext, enterPlatform, inviteUsed]);

  const forgotPassword = useCallback(async () => {
    if (submitting) return;
    if (!email) {
      setNotice(forgotPasswordCopy.emailRequired.message);
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await authForgotPassword({ body: { email } });
    setNotice(res.error ? null : forgotPasswordCopy.sendSuccess.message);
    if (res.error) setError(forgotPasswordCopy.sendError);
    setSubmitting(false);
  }, [email, submitting]);

  // Registration waits until Join, so an account only ever exists alongside a
  // signed agreement.
  const join = useCallback(async () => {
    if (submitting) return;
    if (!latestContract) {
      setError("The membership agreement is unavailable. Please try again.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      if (!registeredRef.current) {
        await authRegister({
          body: {
            name: signedName.trim(),
            email,
            password,
            mode: "header",
            timeZone: deviceTimeZone(),
            referralCode: referralCode || undefined,
          },
        });
        registeredRef.current = true;
      }

      // The signature is the account's own, so the session has to exist first.
      await login({ email, password, navigateOnSuccess: false });

      await contractSignContract({
        path: { id: latestContract.id },
        body: { signedName: signedName.trim() },
      });
    } catch (cause) {
      setError(
        errorMessage({
          error: cause,
          fallback: "We couldn’t complete your sign-up. Please try again.",
        }),
      );
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setReceived(true);
    setTimeout(enterPlatform, 900);
  }, [
    submitting,
    latestContract,
    signedName,
    email,
    password,
    referralCode,
    login,
    enterPlatform,
  ]);

  const agreementSigned =
    Boolean(latestContract) &&
    isCommitted(committed) &&
    signedName.trim().length > 0;

  const tone = STEP_TONE[step];
  const filled = FILLED_SEGMENTS[step];

  // The opening screen reveals band by band, so its eyebrow and footer keep to
  // that pace instead of the shared stagger.
  const opening = step === OnboardingStep.Community;

  const storyStep = (body: React.ReactNode) => (
    <StepLayout
      eyebrow={STEP_EYEBROW[step]}
      eyebrowDelayMs={opening ? COMMUNITY_REVEAL.eyebrow : undefined}
      gap={step === OnboardingStep.Scale ? scale.gap : undefined}
      footer={
        <FooterNav
          onBack={goBack}
          onNext={goNext}
          nextLabel="Continue"
          index={4}
          delayMs={opening ? COMMUNITY_REVEAL.note : undefined}
          toneInk={TONE_INK[tone]}
        />
      }
    >
      {body}
    </StepLayout>
  );

  const panelBody = () => {
    switch (step) {
      case OnboardingStep.Account:
        return (
          <WelcomeGate
            mode={accountMode}
            onModeChange={setAccountMode}
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            onSubmit={submitAccount}
            error={error}
            notice={notice}
            submitting={submitting}
            onForgotPassword={forgotPassword}
            inviteUsed={inviteUsed}
            inviter={inviter}
          />
        );
      case OnboardingStep.Community:
        return storyStep(<CommunityStep />);
      case OnboardingStep.Commitment:
        return storyStep(<CommitmentStep />);
      case OnboardingStep.Scale:
        return storyStep(<ScaleStep />);
      case OnboardingStep.Minutes:
        return storyStep(<MinutesStep />);
      case OnboardingStep.Agreement:
        return (
          <StepLayout
            eyebrow={STEP_EYEBROW[step]}
            footer={
              <FooterNav
                onBack={goBack}
                onNext={join}
                nextLabel="Join"
                nextDisabled={!agreementSigned || submitting || received}
                loading={submitting}
                index={4}
                toneInk={TONE_INK[tone]}
              />
            }
          >
            {contractPending ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#fff" />
              </View>
            ) : latestContract && latestContract.description.length > 0 ? (
              <AgreementStep
                contract={latestContract}
                inviter={inviter}
                faces={faces}
                signedCount={memberCount ?? 0}
                committed={committed}
                onCommittedChange={setCommitted}
                signedName={signedName}
                onSignedNameChange={setSignedName}
                error={error}
                received={received}
              />
            ) : (
              <MissingAgreement />
            )}
          </StepLayout>
        );
      default:
        throw new Error(`unknown onboarding step: ${step satisfies never}`);
    }
  };

  const isGate = step === OnboardingStep.Account;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View
        className="flex-1"
        style={{ backgroundColor: TONE_BACKGROUND[tone] }}
      >
        {panelBody()}
        {filled > 0 && !isGate && <ProgressTrack filled={filled} />}
      </View>
    </KeyboardAvoidingView>
  );
};

function MissingAgreement() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-center text-white" accessibilityRole="alert">
        We couldn’t load the membership agreement. Please restart the app.
      </Text>
    </View>
  );
}

export default OnboardingScreen;
