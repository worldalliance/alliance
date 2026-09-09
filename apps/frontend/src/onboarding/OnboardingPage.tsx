import { AnalyticsEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
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
import type { StyleWithVars } from "@alliance/sharedweb/ui/cssVars";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { href, useLocation, useNavigate, useSearchParams } from "react-router";
import { useSiteBackground } from "../components/HtmlBackgroundManager";
import { useAuth } from "../lib/AuthContext";
import { socialPreviewMeta } from "../lib/socialPreviewMeta";
import { useContract } from "../lib/useContract";
import { useMediaQuery } from "../lib/useMediaQuery";
import { SiteFooter } from "../site/Footer";
import { JoinCta } from "../site/JoinCta";
import { Navbar } from "../site/Navbar";
import { LandingBody } from "../site/sections/LandingBody";
import "../site/site.css";
import { AccountStep } from "./AccountStep";
import { AgreementStep, isCommitted } from "./AgreementStep";
import { FooterNav, ProgressTrack, StepLayout } from "./chrome";
import {
  FILLED_SEGMENTS,
  isOnboardingStep,
  MOBILE_WEB_QUERY,
  OnboardingStep,
  PanelTone,
  STEP_EYEBROW,
  STEP_TONE,
  stepAfter,
  stepBefore,
} from "./flow";
import { GrantmakingCard } from "./GrantmakingCard";
import { JOIN_PHASE_MS, JoinPhase } from "./joinPhase";
import { MobileAppFooter, MobileAppStep } from "./MobileAppStep";
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
      "Join a global community cooperating to improve the world. Members spend 15 minutes a week completing thoughtfully designed actions for measurable impact.",
    url: "/onboarding",
  });
}

/** The closing CTA sends people back up to the form rather than off the page. */
const ACCOUNT_ANCHOR = "#create-account";

const PANEL_STYLE: StyleWithVars = {
  "--ob-leave": `${JOIN_PHASE_MS[JoinPhase.Leaving]}ms`,
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
  const { onLogin } = useAuth();
  const { latestContract } = useContract();
  const [searchParams, setSearchParams] = useSearchParams();

  const stepParam = searchParams.get("step");
  const step = isOnboardingStep(stepParam) ? stepParam : OnboardingStep.Account;
  const referralCode = searchParams.get("ref");
  const isAccount = step === OnboardingStep.Account;
  const mobileWeb = useMediaQuery(MOBILE_WEB_QUERY);
  useLockedViewport(!isAccount);
  const { inviter } = useInvite(referralCode);
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
  const [committed, setCommitted] = useState("");
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinPhase, setJoinPhase] = useState(JoinPhase.Idle);
  const registeredRef = useRef(false);

  const goTo = useCallback(
    (next: OnboardingStep) => {
      // The panel morphs from an absolute box inside the account hero to a
      // fixed one. The two only line up at the top of the page.
      if (next !== OnboardingStep.Account) window.scrollTo({ top: 0 });
      setSearchParams(
        (params) => {
          params.set("step", next);
          return params;
        },
        { preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  useDraftWriter(
    { email, password, step, referralCode },
    !registeredRef.current,
  );

  // A reload with nothing saved cannot submit a half-filled account, so it
  // restarts rather than stranding the member on a later screen.
  useEffect(() => {
    if (step !== OnboardingStep.Account && !email && !registeredRef.current) {
      goTo(OnboardingStep.Account);
    }
  }, [step, email, goTo]);

  // Land back on the screen the draft left off at, once per load.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    if (draft && draft.step !== step) goTo(draft.step);
  }, [draft, step, goTo]);

  useEffect(() => {
    if (!referralCode) return;
    posthog.register_once({ referral_code: referralCode });
    captureEvent(AnalyticsEvent.InvitePageOpened, {
      referral_code: referralCode,
    });
  }, [referralCode]);

  const agreementSigned =
    latestContract !== null &&
    isCommitted(committed) &&
    signedName.trim().length > 0;

  const goNext = useCallback(() => {
    const next = stepAfter(step);
    if (next) goTo(next);
  }, [step, goTo]);

  const goBack = useCallback(() => {
    const previous = stepBefore(step);
    if (previous) goTo(previous);
  }, [step, goTo]);

  const enterPlatform = useCallback(async () => {
    const session = await R.fromPromise(onLogin());
    // The account and the signature are already written, so a session that
    // fails to establish goes to log in. Nothing here may leave the member on
    // the white the panel uncovered, which has no way back.
    navigate(session.ok ? walkthroughStartHref() : href("/login"));
  }, [onLogin, navigate]);

  useEffect(() => {
    const hold = (run: () => void) => {
      const timer = setTimeout(run, JOIN_PHASE_MS[joinPhase]);
      return () => clearTimeout(timer);
    };

    switch (joinPhase) {
      case JoinPhase.Idle:
        return;
      case JoinPhase.Received:
        return hold(() => {
          if (mobileWeb) {
            goTo(OnboardingStep.MobileApp);
            setJoinPhase(JoinPhase.Idle);
            return;
          }
          setJoinPhase(JoinPhase.Leaving);
        });
      case JoinPhase.Leaving:
        return hold(() => void enterPlatform());
      default:
        throw new Error(`unknown join phase: ${joinPhase satisfies never}`);
    }
  }, [joinPhase, goTo, mobileWeb, enterPlatform]);

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

    if (!registeredRef.current) {
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

    setSubmitting(false);
    setJoinPhase(JoinPhase.Received);
  }, [submitting, signedName, email, password, referralCode, latestContract]);

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
                committed={committed}
                onCommittedChange={setCommitted}
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
        return (
          <StepLayout
            eyebrow={STEP_EYEBROW[step]}
            footer={<MobileAppFooter onContinue={enterPlatform} />}
          >
            <MobileAppStep />
          </StepLayout>
        );
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
          <JoinCta to={ACCOUNT_ANCHOR} heading="Create an account" />
          <SiteFooter />
        </>
      )}
    </div>
  );
};

export default OnboardingPage;
