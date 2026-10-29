import { AnalyticsEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
// eslint-disable-next-line api-client/named-hooks-only -- registration opens the session, and join reloads the member itself
import { authRegister } from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { membershipAgreement } from "@alliance/shared/lib/copy";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { deviceTimeZone, signupTimeZone } from "@alliance/shared/lib/timeZone";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useContractSignature } from "@alliance/shared/lib/useContractSignature";
import { useInvite } from "@alliance/shared/lib/useInvite";
import { useMe } from "@alliance/shared/lib/useMe";
import { useSignupFaces } from "@alliance/shared/lib/useSignupFaces";
import { cn } from "@alliance/shared/styles/util";
import {
  clearOAuthParams,
  oauthNoticeMessage,
  useOAuthNotice,
} from "@alliance/sharedweb/lib/oauth";
import { prefersReducedMotion } from "@alliance/sharedweb/lib/reducedMotion";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { href, useLocation, useNavigate, useSearchParams } from "react-router";
import { useSiteBackground } from "../components/HtmlBackgroundManager";
import { useAuth } from "../lib/AuthContext";
import { socialPreviewMeta } from "../lib/socialPreviewMeta";
import { useContract } from "../lib/useContract";
// import { useMediaQuery } from "@alliance/sharedweb/lib/useMediaQuery";
import { SiteFooter } from "../site/Footer";
import { useInviteSession } from "../site/invite/InviteSession";
import { JoinCta } from "../site/JoinCta";
import { Navbar } from "../site/Navbar";
import { LandingBody } from "../site/sections/LandingBody";
import "../site/site.css";
import { AccountStep } from "./AccountStep";
import {
  isOnboardingStep,
  // MOBILE_WEB_QUERY,
  OnboardingStep,
  stepAfter,
  stepBefore,
} from "./flow";
import { GrantmakingCard } from "./GrantmakingCard";
import { JoinPhase, PANEL_FADE_MS } from "./joinPhase";
import "./onboarding.css";
import { OnboardingPanel } from "./OnboardingPanel";
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

const OnboardingPage = () => {
  useSiteBackground();
  const navigate = useNavigate();
  const location = useLocation();
  const { onLogin, isAuthenticated, user, loading: authLoading } = useAuth();
  const { fetch: fetchMe } = useMe();
  const { latestContract } = useContract();
  const contractSignature = useContractSignature();
  const [searchParams, setSearchParams] = useSearchParams();
  const oauthNotice = useOAuthNotice();

  const stepParam = searchParams.get("step");
  // The provider lands here before auth loads. Until the OAuth effect below
  // redirects, Account and any draft that points back at it would flash the
  // invite-only heading. The notice outlives that redirect; the landing ends
  // once a step is in the URL.
  const oauthLanding =
    oauthNotice?.kind === "outcome" && !isOnboardingStep(stepParam);
  const step = isOnboardingStep(stepParam)
    ? stepParam
    : oauthLanding
      ? OnboardingStep.Community
      : OnboardingStep.Account;
  const referralCode = searchParams.get("ref");
  const isAccount = step === OnboardingStep.Account;
  // const mobileWeb = useMediaQuery(MOBILE_WEB_QUERY);
  useLockedViewport(!isAccount);
  const { inviter, refusal: inviteRefusal } = useInvite(referralCode);
  const { clear: clearInvite } = useInviteSession();
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
  // A provider hands the member back on a later screen. Morphing the panel out
  // of the sign-up hero from there just plays the account screen underneath it.
  const [skipPanelMorph, setSkipPanelMorph] = useState(false);
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

  useDraftWriter(
    { email, password, step, referralCode },
    !registered && !oauthLanding,
  );

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
    if (oauthLanding) return;
    if (draft && draft.step !== step) goTo(draft.step);
  }, [draft, step, goTo, oauthLanding]);

  const oauthError =
    oauthNotice?.kind === "error" ? oauthNoticeMessage(oauthNotice) : null;

  // A provider creates the account up front, so a new member rejoins the flow
  // at the story with registration already done and the agreement still owed.
  //
  // Which outcome fired does not say who came back: the provider returns
  // `linked` rather than `signed_up` for any address that already has a user
  // row, which is every invited member whose partial profile was pre-created.
  // All three leave the member signed in, so the agreement is what decides
  // where they belong.
  // Once only: the notice outlives the step change that rebuilds `goTo`.
  const oauthHandledRef = useRef(false);
  useEffect(() => {
    if (oauthNotice?.kind !== "outcome" || oauthHandledRef.current) return;
    // The session the provider just set, rather than a fetch of our own: an
    // await here would land `goTo` in a later tick than the notice's own strip
    // of the URL, and the strip composes off the params it rendered with, so
    // whichever settled last won and the step was dropped about a third of the
    // time.
    if (authLoading) return;
    oauthHandledRef.current = true;
    registeredRef.current = true;
    clearDraft();
    clearInvite();

    if (user?.hasActiveContract) {
      navigate(redirectAfterLogin);
      return;
    }
    setSkipPanelMorph(true);
    goTo(OnboardingStep.Community);
  }, [
    oauthNotice,
    authLoading,
    user,
    goTo,
    navigate,
    redirectAfterLogin,
    clearInvite,
  ]);

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
    const fadeMs = prefersReducedMotion() ? 0 : PANEL_FADE_MS;
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
          timeZone: signupTimeZone(deviceTimeZone()),
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
      clearInvite();

      const me = await R.fromPromise(fetchMe());
      const user = me.ok ? me.value.user : undefined;
      if (user) {
        posthog.identify(user.id.toString(), {
          email: user.email,
          name: user.name,
          referral_code: referralCode,
        });
      }
    }

    const signature = await contractSignature.sign({
      contractId: latestContract.id,
      signedName: signedName.trim(),
    });
    if (!signature.ok) {
      setError(
        thrownRefusalMessage({
          error: signature.error,
          fallback: "We couldn’t record your agreement. Please try again.",
          sessionExpired: membershipAgreement.signSessionExpired,
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
    clearInvite,
    fetchMe,
    contractSignature,
  ]);

  // Every provider sign-in returns here, so until auth says where the member
  // belongs, any step shown is the wrong one for someone.
  if (oauthLanding && (authLoading || user?.hasActiveContract)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "ob-root site-root relative bg-white",
        isAccount ? "min-h-dvh overflow-x-clip" : "h-dvh overflow-hidden",
      )}
    >
      <div className="relative h-dvh">
        {/* Same tier as the panel, which follows it in the DOM and so stays on
            top: the panel fades out over this rather than being cut off by it. */}
        {joinPhase === JoinPhase.Leaving && (
          <div
            className={cn(
              zIndex.drawer,
              "fixed inset-0 flex items-center justify-center bg-white",
            )}
          >
            <Spinner size="large" />
          </div>
        )}
        <div
          className={cn(
            "transition-opacity duration-500",
            isAccount ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <Navbar offerInvite={location.pathname === href("/login")} />
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

        <OnboardingPanel
          step={step}
          skipPanelMorph={skipPanelMorph}
          joinPhase={joinPhase}
          goBack={goBack}
          goNext={goNext}
          join={join}
          agreementSigned={agreementSigned}
          submitting={submitting}
          latestContract={latestContract}
          inviter={inviter}
          faces={faces}
          memberCount={memberCount}
          signedName={signedName}
          onSignedNameChange={setSignedName}
          error={error}
        />
      </div>

      {isAccount && (
        <>
          <section className="bg-[var(--site-surface)] px-5 pb-14 lg:hidden">
            <GrantmakingCard className="min-h-80" />
          </section>
          <LandingBody />
          <JoinCta
            to={inviteRefusal ? undefined : ACCOUNT_ANCHOR}
            label={inviteRefusal ? undefined : "Create an account"}
          />
          <SiteFooter />
        </>
      )}
    </div>
  );
};

export default OnboardingPage;
