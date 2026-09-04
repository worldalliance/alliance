import { AnalyticsEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
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
import { SiteFooter } from "../site/Footer";
import { JoinCta } from "../site/JoinCta";
import { Navbar } from "../site/Navbar";
import { LandingBody } from "../site/sections/LandingBody";
import "../site/site.css";
import { AccountStep, PlatformMockup } from "./AccountStep";
import { AgreementStep } from "./AgreementStep";
import { FooterNav, ProgressTrack, StepLayout } from "./chrome";
import {
  FILLED_SEGMENTS,
  isOnboardingStep,
  OnboardingStep,
  PanelTone,
  STEP_EYEBROW,
  STEP_TONE,
  stepAfter,
  stepBefore,
} from "./flow";
import { JOIN_PHASE_MS, JoinPhase, type FloodOrigin } from "./joinPhase";
import { MobileAppFooter, MobileAppStep } from "./MobileAppStep";
import "./onboarding.css";
import {
  CommitmentStep,
  CommunityStep,
  MinutesStep,
  ScaleStep,
} from "./StorySteps";
import { useLockedViewport } from "./useLockedViewport";
import { walkthroughStartHref, WELCOME_SECONDS } from "./walkthrough/steps";
import { WelcomeBackdrop, WelcomeStep } from "./WelcomeStep";

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

/** `--ob-tone-ink` is the colour the footer's white primary button letters in. */
const TONE_CLASS: Record<PanelTone, string> = {
  [PanelTone.Navy]: "bg-[var(--ob-navy)] [--ob-tone-ink:var(--ob-navy)]",
  [PanelTone.Photo]: "bg-[#2d5a22] [--ob-tone-ink:var(--ob-green)]",
  [PanelTone.Green]: "bg-[var(--ob-green)] [--ob-tone-ink:var(--ob-green)]",
};

function floodStyle(origin: FloodOrigin): StyleWithVars {
  return {
    "--ob-flood-top": `${origin.top}px`,
    "--ob-flood-left": `${origin.left}px`,
    "--ob-flood-width": `${origin.width}px`,
    "--ob-flood-height": `${origin.height}px`,
  };
}

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
  useLockedViewport(!isAccount);
  const { inviter } = useInvite(referralCode);
  const faces = useSignupFaces(referralCode);
  const { data: memberCount } = useAllianceMemberCount();

  const redirectAfterLogin = useMemo(() => {
    const target = searchParams.get("redirect");
    return target?.startsWith("/") ? target : href("/tasks");
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [committed, setCommitted] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinPhase, setJoinPhase] = useState(JoinPhase.Idle);
  const [floodOrigin, setFloodOrigin] = useState<FloodOrigin | null>(null);
  const registeredRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const receivedBarRef = useRef<HTMLDivElement>(null);

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

  // A reload drops everything the later screens need, so the flow restarts
  // rather than submitting a half-filled account.
  useEffect(() => {
    if (step !== OnboardingStep.Account && !email && !registeredRef.current) {
      goTo(OnboardingStep.Account);
    }
  }, [step, email, goTo]);

  useEffect(() => {
    if (!referralCode) return;
    posthog.register_once({ referral_code: referralCode });
    captureEvent(AnalyticsEvent.InvitePageOpened, {
      referral_code: referralCode,
    });
  }, [referralCode]);

  const agreementSigned =
    latestContract !== null && committed && signedName.trim().length > 0;

  const goNext = useCallback(() => {
    const next = stepAfter(step);
    if (next) goTo(next);
  }, [step, goTo]);

  const goBack = useCallback(() => {
    const previous = stepBefore(step);
    if (previous) goTo(previous);
  }, [step, goTo]);

  const enterPlatform = useCallback(async () => {
    await onLogin();
    navigate(walkthroughStartHref());
  }, [onLogin, navigate]);

  useEffect(() => {
    if (step !== OnboardingStep.Welcome) return;
    const timer = setTimeout(goNext, WELCOME_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [step, goNext]);

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
          const panel = panelRef.current?.getBoundingClientRect();
          const bar = receivedBarRef.current?.getBoundingClientRect();
          if (panel && bar) {
            setFloodOrigin({
              top: bar.top - panel.top,
              left: bar.left - panel.left,
              width: bar.width,
              height: bar.height,
            });
          }
          setJoinPhase(JoinPhase.Flooding);
        });
      case JoinPhase.Flooding:
        return hold(() => {
          goTo(OnboardingStep.Welcome);
          setJoinPhase(JoinPhase.Settling);
        });
      case JoinPhase.Settling:
        return hold(() => {
          setJoinPhase(JoinPhase.Idle);
          setFloodOrigin(null);
        });
      default:
        throw new Error(`unknown join phase: ${joinPhase satisfies never}`);
    }
  }, [joinPhase, goTo]);

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
        return <PlatformMockup />;
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
                receivedBarRef={receivedBarRef}
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
      case OnboardingStep.Welcome:
        return (
          <WelcomeStep
            memberNumber={(memberCount ?? 0) + 1}
            onContinue={goNext}
          />
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
          ref={panelRef}
          className={cn(
            "ob-panel z-50",
            isAccount ? "ob-panel--intro hidden md:block" : "ob-panel--full",
            TONE_CLASS[STEP_TONE[step]],
          )}
        >
          {step === OnboardingStep.Welcome && <WelcomeBackdrop />}
          <div key={step} className="relative size-full">
            {panelBody()}
          </div>
          {floodOrigin && (
            <div
              className={cn(
                "ob-flood z-10",
                joinPhase === JoinPhase.Settling && "ob-flood--out",
              )}
              style={floodStyle(floodOrigin)}
              aria-hidden
            />
          )}
          {filled > 0 && <ProgressTrack filled={filled} />}
        </div>
      </div>

      {isAccount && (
        <>
          <LandingBody />
          <JoinCta to={ACCOUNT_ANCHOR} heading="Create an account" />
          <SiteFooter />
        </>
      )}
    </div>
  );
};

export default OnboardingPage;
