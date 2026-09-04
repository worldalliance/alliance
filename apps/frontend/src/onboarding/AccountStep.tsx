import { authForgotPassword, authLogin } from "@alliance/shared/client";
import { forgotPassword as forgotPasswordCopy } from "@alliance/shared/lib/copy";
import { Features } from "@alliance/shared/lib/features";
import { useInvite } from "@alliance/shared/lib/useInvite";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { z } from "zod";
import platformMock from "../assets/redesign/onboarding/PlatformMock.png";
import { useAuth } from "../lib/AuthContext";
import { isFeatureEnabled } from "../lib/config";
import { SiteArrow } from "../site/ui";
import { riseStyle } from "./chrome";
import {
  EmailDivider,
  GOOGLE_SIGN_IN_AVAILABLE,
  GoogleSignIn,
} from "./GoogleSignIn";

const STANDFIRST =
  "To combat global problems, we commit 15 minutes each week to projects that depend on everyone’s participation.";

const FIELD =
  "h-11 w-full rounded-md border border-zinc-300/80 bg-zinc-100! px-3.5 text-sm text-black outline-none transition-colors placeholder:text-zinc-500 focus:border-[var(--ob-navy)] focus:bg-white!";

const CARD_BUTTON = "w-full gap-2 py-2.5";

const emailSchema = z.email();

/**
 * Traced from the Figma frame: the whole platform at 75% of the panel's height,
 * inset from its left, so the panel's right edge cuts it near the middle at any
 * size rather than cropping in on a corner.
 */
export function PlatformMockup() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <img
        src={platformMock}
        alt=""
        className="ob-scale-in absolute top-[14%] left-[17%] h-[75%] max-w-none rounded-xl shadow-[0_0_34px_6px_rgba(255,255,255,0.5),0_0_100px_34px_rgba(255,255,255,0.25)]"
        style={{ animationDelay: "260ms" }}
      />
    </div>
  );
}

export function AccountStep({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onCreateAccount,
  redirectAfterLogin,
  startInLogin,
  referralCode,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  onCreateAccount: () => void;
  redirectAfterLogin: string;
  /** `/login` opens straight onto the password field. */
  startInLogin: boolean;
  referralCode: string | null;
}) {
  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const { used: inviteUsed, inviter } = useInvite(referralCode);
  const inviteOnly =
    (!isFeatureEnabled(Features.PublicSignup) && !referralCode) || inviteUsed;
  const [loggingIn, setLoggingIn] = useState(startInLogin);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const emailValid = emailSchema.safeParse(email.trim()).success;
  const ready = emailValid && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!loggingIn) {
      onCreateAccount();
      return;
    }

    setPending(true);
    const res = await authLogin({
      body: { email, password, mode: "cookie" },
    });
    if (res.response.ok) {
      await onLogin();
      navigate(redirectAfterLogin);
      return;
    }
    setError("Invalid email or password");
    setPending(false);
  };

  const handleForgotPassword = async () => {
    if (pending) return;
    if (!email) {
      setNotice(forgotPasswordCopy.emailRequired.message);
      return;
    }
    setError(null);
    setPending(true);
    const res = await authForgotPassword({ body: { email } });
    setNotice(res.error ? null : forgotPasswordCopy.sendSuccess.message);
    if (res.error) setError(forgotPasswordCopy.sendError);
    setPending(false);
  };

  return (
    <div
      id="create-account"
      className="flex h-dvh flex-col overflow-hidden md:w-1/2"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pt-24 pb-6 sm:px-8">
        <div className="ob-rise w-full max-w-[22rem]" style={riseStyle(0)}>
          <h1 className="text-center text-lg font-semibold text-black">
            {loggingIn ? "Log In" : "Create an Account"}
          </h1>
          {!loggingIn && inviter && (
            <div className="mt-2 flex flex-row items-center justify-center gap-x-2 text-sm text-zinc-500">
              <AvatarProfile
                pfp={inviter.profilePicture}
                size="override"
                alt=""
                className="size-6 shrink-0 rounded-[5px]"
              />
              <span>
                <span className="font-medium text-black">
                  {inviter.displayName}
                </span>{" "}
                invited you to the Alliance
              </span>
            </div>
          )}
          {inviteOnly && !loggingIn && !inviter && (
            <p className="mt-2 text-center text-sm text-zinc-600">
              {inviteUsed
                ? "That invite link has already been used."
                : "The Alliance is invite-only."}
            </p>
          )}
          {GOOGLE_SIGN_IN_AVAILABLE && (
            <div className="mt-4 flex flex-col gap-3">
              <GoogleSignIn />
              <EmailDivider />
            </div>
          )}
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className={FIELD}
              aria-label="Email"
            />
            {/* Held back until the email is valid, so the card opens on one
                decision rather than two. */}
            {emailValid && (
              <input
                name="password"
                type="password"
                required
                autoFocus
                autoComplete={loggingIn ? "current-password" : "new-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                className={cn(FIELD, "ob-rise")}
                style={{ animationDuration: "380ms" }}
                aria-label="Password"
              />
            )}
            {error && (
              <p className="text-sm font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
            {notice && <p className="text-sm text-zinc-600">{notice}</p>}
            <Button
              type="submit"
              color={ButtonColor.Black}
              className={CARD_BUTTON}
              disabled={pending || !ready}
            >
              {loggingIn ? "Log In" : "Get Started"}
              <SiteArrow className="size-2.5" />
            </Button>
            <Button
              color={ButtonColor.Grey}
              className={CARD_BUTTON}
              onClick={() => {
                setLoggingIn((value) => !value);
                setError(null);
                setNotice(null);
              }}
            >
              {loggingIn ? "Create an account" : "I already have an account"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            {loggingIn && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={pending}
                className="text-sm text-[var(--site-link)] hover:underline disabled:opacity-60"
              >
                {forgotPasswordCopy.prompt}
              </button>
            )}
          </form>
        </div>
      </div>
      <p
        className="ob-rise max-w-[33rem] px-5 pb-8 text-[1.05rem] leading-[1.35] text-black sm:px-8 sm:pb-10 sm:text-[1.3rem]"
        style={riseStyle(2)}
      >
        {STANDFIRST}
      </p>
    </div>
  );
}
