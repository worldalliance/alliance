import { AnalyticsEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
import { OAuthOutcome } from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import {
  authMe,
  authRegister,
  contractSignContract,
} from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useInvite } from "@alliance/shared/lib/useInvite";
import { useSignupFaces } from "@alliance/shared/lib/useSignupFaces";
import { cn } from "@alliance/shared/styles/util";
import {
  clearOAuthParams,
  oauthNoticeMessage,
  useOAuthNotice,
} from "@alliance/sharedweb/lib/oauth";
import type { StyleWithVars } from "@alliance/sharedweb/ui/cssVars";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { href, useLocation, useNavigate, useSearchParams } from "react-router";
import { useSiteBackground } from "../components/HtmlBackgroundManager";
import { useAuth } from "../lib/AuthContext";
import { socialPreviewMeta } from "../lib/socialPreviewMeta";
import { useContract } from "../lib/useContract";
// import { useMediaQuery } from "../lib/useMediaQuery";
import { SiteFooter } from "../site/Footer";
import { JoinCta } from "../site/JoinCta";
import { Navbar } from "../site/Navbar";
import { LandingBody } from "../site/sections/LandingBody";
import "../site/site.css";
import { AccountStep } from "./AccountStep";
import { AgreementStep } from "./AgreementStep";
import { FooterNav, ProgressTrack, StepLayout } from "./chrome";
import {
  FILLED_SEGMENTS,
  isOnboardingStep,
  // MOBILE_WEB_QUERY,
  OnboardingStep,
  PanelTone,
  STEP_EYEBROW,
  STEP_TONE,
  stepAfter,
  stepBefore,
} from "./flow";
import { GrantmakingCard } from "./GrantmakingCard";
import { JoinPhase, PANEL_FADE_MS } from "./joinPhase";
// import { MobileAppFooter, MobileAppStep } from "./MobileAppStep";
import "./onboarding.css";
import {
  CommitmentStep,
  CommunityStep,
  MinutesStep,
  ScaleStep,
} from "./StorySteps";
import { useLockedViewport } from "./useLockedViewport";
import {
  clearDraft,
  useDraftWriter,
  useInitialDraft,
} from "./useOnboardingDraft";
import { walkthroughStartHref } from "./walkthrough/steps";

export function meta() {
  return socialPreviewMeta({
    title: "Join the Alliance",
    description:
      "Join a global community cooperating to improve the world. Members spend 15 minutes a week completing actions designed for measurable impact.",
    url: "/onboarding",
  });
}

/** The closing CTA sends people back up to the form rather than off the page. */
const ACCOUNT_ANCHOR = "#create-account";

const PANEL_STYLE: StyleWithVars = {
  "--ob-leave": `${PANEL_FADE_MS}ms`,
};

/** `--ob-tone-ink` is the colour the footer's white primary button letters in. */
const TONE_CLASS: Record<PanelTone, string> = {
  [PanelTone.Navy]: "bg-[var(--ob-navy)] [--ob-tone-ink:var(--ob-navy)]",
  [PanelTone.Green]: "bg-[var(--ob-green)] [--ob-tone-ink:var(--ob-green)]",
};

const OnboardingPage = () => {
  useSiteBackground();
  const navigate = useNavigate();
  const location = useLocation();
  const { onLogin, isAuthenticated, loading: authLoading } = useAuth();
  const { latestContract } = useContract();
  const [searchParams, setSearchParams] = useSearchParams();

  const stepParam = searchParams.get("step");
  const step = isOnboardingStep(stepParam) ? stepParam : OnboardingStep.Account;
  const referralCode = searchParams.get("ref");
  const isAccount = step === OnboardingStep.Account;
  // const mobileWeb = useMediaQuery(MOBILE_WEB_QUERY);
  useLockedViewport(!isAccount);
  const { inviter, used: inviteUsed } = useInvite(referralCode);
  const faces = useSignupFaces(referralCode, {
    enabled: step === OnboardingStep.Agreement,
  });
  const { data: memberCount } = useAllianceMemberCount();

  const redirectAfterLogin = useMemo(() => {
    const target = searchParams.get("redirect");
    return target?.startsWith("/") ? target : href("/tasks");
  }, [searchParams]);

  const draft = useInitialDraft(referralCode);
  const [email, setEmail] = useState(draft?.email ?? "");
  const [password, setPassword] = useState(draft?.password ?? "");
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinPhase, setJoinPhase] = useState(JoinPhase.Idle);
  const registeredRef = useRef(false);
  const leavingRef = useRef(false);
  // A provider signs the member in before the flow starts, so a session counts
  // as an account the same way registering at Join does.
  const registered = registeredRef.current || isAuthenticated;

  const goTo = useCallback(
    (next: OnboardingStep) => {
      // The panel morphs from an absolute box inside the account hero to a
      // fixed one. The two only line up at the top of the page.
      if (next !== OnboardingStep.Account) window.scrollTo({ top: 0 });
      setSearchParams(
        (params) => {
          clearOAuthParams(params);
          params.set("step", next);
          return params;
        },
        { preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  useDraftWriter({ email, password, step, referralCode }, !registered);

  // A reload with nothing saved cannot submit a half-filled account, so it
  // restarts rather than stranding the member on a later screen.
  useEffect(() => {
    if (authLoading) return;
    if (step !== OnboardingStep.Account && !email && !registered) {
      goTo(OnboardingStep.Account);
    }
  }, [step, email, goTo, registered, authLoading]);

  // Land back on the screen the draft left off at, once per load.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    if (draft && draft.step !== step) goTo(draft.step);
  }, [draft, step, goTo]);

  const oauthNotice = useOAuthNotice();
  const oauthError =
    oauthNotice?.kind === "error" ? oauthNoticeMessage(oauthNotice) : null;

  // A provider creates the account up front, so a new member rejoins the flow
  // at the story with registration already done and the agreement still owed.
  // Once only: the notice outlives the step change that rebuilds `goTo`.
  const oauthHandledRef = useRef(false);
  useEffect(() => {
    if (oauthNotice?.kind !== "outcome" || oauthHandledRef.current) return;
    oauthHandledRef.current = true;
    switch (oauthNotice.outcome) {
      case OAuthOutcome.SignedUp:
        registeredRef.current = true;
        clearDraft();
        goTo(OnboardingStep.Community);
        return;
      case OAuthOutcome.SignedIn:
        onLogin().then(() => navigate(redirectAfterLogin));
        return;
      case OAuthOutcome.Linked:
        return;
      default:
        throw new Error(
          `unknown oauth outcome: ${oauthNotice.outcome satisfies never}`,
        );
    }
  }, [oauthNotice, goTo, onLogin, navigate, redirectAfterLogin]);

  useEffect(() => {
    if (!referralCode) return;
    posthog.register_once({ referral_code: referralCode });
    captureEvent(AnalyticsEvent.InvitePageOpened, {
      referral_code: referralCode,
    });
  }, [referralCode]);

  const agreementSigned =
    latestContract !== null && signedName.trim().length > 0;

  const goNext = useCallback(() => {
    const next = stepAfter(step);
    if (next) goTo(next);
  }, [step, goTo]);

  const goBack = useCallback(() => {
    const previous = stepBefore(step);
    if (previous) goTo(previous);
  }, [step, goTo]);

  const enterPlatform = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setJoinPhase(JoinPhase.Leaving);
    const fadeMs = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : PANEL_FADE_MS;
    const fade = new Promise<void>((resolve) => {
      window.setTimeout(resolve, fadeMs);
    });
    const sessionP = R.fromPromise(onLogin());
    const [, session] = await Promise.all([fade, sessionP]);
    navigate(session.ok ? walkthroughStartHref() : href("/login"));
  }, [onLogin, navigate]);

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

    if (!registered) {
      const registration = await authRegister({
        body: {
          name: signedName.trim(),
          email,
          password,
          mode: "cookie",
          timeZone: deviceTimeZone(),
          referralCode: referralCode || undefined,
        },
      });
      if (!registration.response.ok) {
        setError(
          errorMessage({
            error: registration.error,
            fallback: "We couldn’t create your account. Please try again.",
          }),
        );
        setSubmitting(false);
        return;
      }
      registeredRef.current = true;
      clearDraft();

      const me = await authMe();
      const user = me.data?.user;
      if (user) {
        posthog.identify(user.id.toString(), {
          email: user.email,
          name: user.name,
          referral_code: referralCode,
        });
      }
    }

    const signature = await contractSignContract({
      path: { id: latestContract.id },
      body: { signedName: signedName.trim() },
    });
    if (!signature.response.ok) {
      setError(
        errorMessage({
          error: signature.error,
          fallback: "We couldn’t record your agreement. Please try again.",
        }),
      );
      setSubmitting(false);
      return;
    }

    // if (mobileWeb) {
    //   setSubmitting(false);
    //   goTo(OnboardingStep.MobileApp);
    //   return;
    // }
    await enterPlatform();
    setSubmitting(false);
  }, [
    submitting,
    registered,
    signedName,
    email,
    password,
    referralCode,
    latestContract,
    enterPlatform,
  ]);

  const filled = FILLED_SEGMENTS[step];

  const storyStep = (body: React.ReactNode) => (
    <StepLayout
      eyebrow={STEP_EYEBROW[step]}
      footer={
        <FooterNav
          onBack={goBack}
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
        return storyStep(<CommitmentStep />);
      case OnboardingStep.Scale:
        return storyStep(<ScaleStep />);
      case OnboardingStep.Minutes:
        return storyStep(<MinutesStep />);
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
                onSignedNameChange={setSignedName}
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
        "ob-root site-root relative bg-white",
        isAccount ? "min-h-dvh overflow-x-clip" : "h-dvh overflow-hidden",
      )}
    >
      <div className="relative h-dvh">
        {joinPhase === JoinPhase.Leaving && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-white">
            <Spinner size="large" />
          </div>
        )}
        <div
          className={cn(
            "transition-opacity duration-500",
            isAccount ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <Navbar />
          <AccountStep
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            onCreateAccount={goNext}
            redirectAfterLogin={redirectAfterLogin}
            startInLogin={location.pathname === href("/login")}
            referralCode={referralCode}
            providerError={oauthError}
          />
        </div>

        <div
          className={cn(
            "ob-panel z-50",
            isAccount ? "ob-panel--intro hidden md:block" : "ob-panel--full",
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
      </div>

      {isAccount && (
        <>
          <section className="bg-[var(--site-surface)] px-5 pb-14 md:hidden">
            <GrantmakingCard className="min-h-80" />
          </section>
          <LandingBody />
          <JoinCta
            to={inviteUsed ? undefined : ACCOUNT_ANCHOR}
            heading={inviteUsed ? undefined : "Create an account"}
          />
          <SiteFooter />
        </>
      )}
    </div>
  );
};

export default OnboardingPage;
