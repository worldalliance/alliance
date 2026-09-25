import { AnalyticsEvent, ExceptionEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
import type { OAuthProvider } from "@alliance/common/oauth";
import { run } from "@alliance/common/run";
import {
  authForgotPassword,
  authRegister,
  contractGetCurrent,
  contractSignContract,
} from "@alliance/shared/client";
import { captureEvent, captureException } from "@alliance/shared/lib/analytics";
import { forgotPassword as forgotPasswordCopy } from "@alliance/shared/lib/copy";
import { deviceTimeZone, signupTimeZone } from "@alliance/shared/lib/timeZone";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useInvite } from "@alliance/shared/lib/useInvite";
import { useSignupFaces } from "@alliance/shared/lib/useSignupFaces";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
import { takeInterruptedAuthTab } from "../../lib/oauth";
import {
  AuthTabFlow,
  interruptedFailure,
  providerFailureFor,
  UNFINISHED_FAILURE,
  type ProviderFailure,
} from "../../lib/oauthResult";
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
  motion,
  onboardingColors,
  useOnboardingScale,
} from "../../lib/onboarding/scale";
import { passwordLoginFailure } from "../../lib/session";

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
  const { login, loginWithProvider, isAuthenticated, isLoading } = useAuth();
  const {
    ref: referralCode,
    step: stepParam,
    oauthInterrupted,
  } = useLocalSearchParams<{
    ref?: string;
    step?: string;
    oauthInterrupted?: string;
  }>();

  // `?step=` opens any screen without registering, so the later ones can be
  // reviewed now that mobile has no sign-up. Development builds only.
  const [step, setStep] = useState(
    __DEV__ && isOnboardingStep(stepParam) ? stepParam : OnboardingStep.Account,
  );
  // Account creation happens on the web for now, so the mobile gate only logs in.
  const accountMode = AccountMode.LogIn;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(
    null,
  );
  const [providerFailure, setProviderFailure] =
    useState<ProviderFailure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [received, setReceived] = useState(false);
  const registeredRef = useRef(false);
  const leavingRef = useRef(false);
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

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

  // A signed-in member opens a browser session only to connect an account, so
  // their cut-off return link belongs to settings. The param is cleared once
  // read, so a later login here still fades out.
  useEffect(() => {
    if (!oauthInterrupted || isLoading) return;
    if (isAuthenticated) {
      router.replace({ pathname: "/settings", params: { oauthInterrupted } });
      return;
    }
    setProviderFailure(interruptedFailure(oauthInterrupted));
    router.setParams({ oauthInterrupted: undefined });
  }, [oauthInterrupted, isLoading, isAuthenticated, router]);

  useEffect(() => {
    run(async () => {
      if (await takeInterruptedAuthTab(AuthTabFlow.SignIn)) {
        setProviderFailure(UNFINISHED_FAILURE);
      }
      // A connect cut off before a signed-out launch would otherwise send
      // whoever signs in next to settings about a connect they didn't start.
      void takeInterruptedAuthTab(AuthTabFlow.Link);
    });
  }, []);

  useEffect(() => {
    if (!referralCode) return;
    captureEvent(AnalyticsEvent.InvitePageOpened, {
      referral_code: referralCode,
    });
  }, [referralCode]);

  const enterPlatform = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const go = () => router.replace("/");
    fade.value = withTiming(0, { duration: motion.stepFadeMs }, (done) => {
      if (done) runOnJS(go)();
    });
  }, [router, fade]);

  const goNext = useCallback(() => {
    const next = stepAfter(step);
    if (next) setStep(next);
  }, [step]);

  const goBack = useCallback(() => {
    const previous = stepBefore(step);
    if (previous) setStep(previous);
  }, [step]);

  const submitAccount = useCallback(async () => {
    setError(null);
    setNotice(null);
    setProviderFailure(null);
    setSubmitting(true);
    try {
      await login({ email, password, navigateOnSuccess: false });
      enterPlatform();
    } catch (error) {
      const failure = passwordLoginFailure(error);
      if (failure.report) {
        console.error("password login failed", error);
        captureException(ExceptionEvent.PasswordLoginFailed, error);
      }
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }, [email, password, login, enterPlatform]);

  const continueWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      if (submitting || pendingProvider) return;
      setError(null);
      setNotice(null);
      setProviderFailure(null);
      setPendingProvider(provider);
      const signedIn = await loginWithProvider(provider);
      if (signedIn.ok) {
        // Left set through the fade, so a tap on the way out can't start a
        // second sign-in behind the screen.
        enterPlatform();
        return;
      }
      setPendingProvider(null);
      setProviderFailure(
        providerFailureFor({ provider, failure: signedIn.error }),
      );
    },
    [submitting, pendingProvider, loginWithProvider, enterPlatform],
  );

  const forgotPassword = useCallback(async () => {
    if (submitting) return;
    if (!email) {
      setNotice(forgotPasswordCopy.emailRequired.message);
      return;
    }
    setError(null);
    setProviderFailure(null);
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
            timeZone: signupTimeZone(deviceTimeZone()),
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
    enterPlatform();
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
    Boolean(latestContract) && signedName.trim().length > 0;

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
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            onSubmit={submitAccount}
            error={error}
            notice={notice}
            submitting={submitting}
            onForgotPassword={forgotPassword}
            pendingProvider={pendingProvider}
            providerFailure={providerFailure}
            onContinueWithProvider={continueWithProvider}
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
    // The gate runs its own keyboard handling, so the photo behind the form
    // keeps its height while only the form moves.
    <KeyboardAvoidingView
      behavior="padding"
      enabled={!isGate}
      style={{ flex: 1 }}
    >
      <Animated.View
        className="flex-1"
        style={[{ backgroundColor: TONE_BACKGROUND[tone] }, fadeStyle]}
      >
        {panelBody()}
        {filled > 0 && !isGate && <ProgressTrack filled={filled} />}
      </Animated.View>
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
