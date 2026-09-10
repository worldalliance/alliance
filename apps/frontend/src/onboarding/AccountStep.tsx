import { OAuthIntent } from "@alliance/common/oauth";
import { authForgotPassword, authLogin } from "@alliance/shared/client";
import { forgotPassword as forgotPasswordCopy } from "@alliance/shared/lib/copy";
import { Features } from "@alliance/shared/lib/features";
import { useInvite } from "@alliance/shared/lib/useInvite";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { oauthStartUrl, useAppOrigin } from "@alliance/sharedweb/lib/oauth";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import OAuthButtons from "@alliance/sharedweb/ui/OAuthButtons";
import { useState } from "react";
import { href, useNavigate } from "react-router";
import { z } from "zod";
import { useAuth } from "../lib/AuthContext";
import { getApiUrl, isFeatureEnabled } from "../lib/config";
import { JOIN_MAILTO } from "../site/content";
import { SiteArrow } from "../site/ui";
import { EmailDivider, riseStyle } from "./chrome";
import { InfoSessionButton } from "./GrantmakingCard";

const FIELD =
  "h-11 w-full rounded-md border border-zinc-300 bg-white px-3.5 text-sm text-black outline-none transition-colors placeholder:text-zinc-500 focus:border-[var(--ob-navy)]";

const CARD_BUTTON = "w-full gap-2 py-2.5";

const emailSchema = z.email();

export function AccountStep({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onCreateAccount,
  redirectAfterLogin,
  startInLogin,
  referralCode,
  providerError,
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
  providerError: string | null;
}) {
  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const {
    used: inviteUsed,
    pending: invitePending,
    inviter,
  } = useInvite(referralCode);
  const inviteOnly =
    (!isFeatureEnabled(Features.PublicSignup) && !referralCode) || inviteUsed;
  const [loggingIn, setLoggingIn] = useState(startInLogin);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showForm = loggingIn || (!inviteOnly && !invitePending);

  const emailValid = emailSchema.safeParse(email.trim()).success;
  const ready = emailValid && password.length > 0;

  // Back into the flow rather than to the app, so a new account still passes
  // through the agreement.
  const origin = useAppOrigin(getBaseUrl());
  const oauthReturnTo = (() => {
    const url = new URL(`${origin}${href("/onboarding")}`);
    if (referralCode) url.searchParams.set("ref", referralCode);
    return url.toString();
  })();

  const heading = loggingIn
    ? "Log into your account"
    : inviteUsed
      ? "This invite link has already been used."
      : inviteOnly
        ? "The Alliance is invite-only."
        : "Create an account";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!loggingIn) {
      if (inviteOnly) return;
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
          <h1 className="text-center text-2xl font-semibold text-black sm:text-3xl">
            {heading}
          </h1>
          {inviter && (
            <div className="mt-3 flex flex-row items-center justify-center gap-x-2 text-base text-zinc-500">
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
          {providerError && (
            <p className="mt-6 text-sm font-medium text-red-600" role="alert">
              {providerError}
            </p>
          )}
          {showForm && (
            <div className="mt-8">
              <div className="mb-3 flex flex-col gap-3">
                <OAuthButtons
                  verb={loggingIn ? "Log in with" : "Sign up with"}
                  hrefFor={(provider) =>
                    oauthStartUrl({
                      apiUrl: getApiUrl(),
                      provider,
                      intent: OAuthIntent.Authenticate,
                      returnTo: oauthReturnTo,
                      referralCode,
                    })
                  }
                />
                <EmailDivider />
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete={loggingIn ? "current-password" : "new-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  className={FIELD}
                  aria-label="Password"
                />
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
                  {loggingIn ? "Log in" : "Get started"}
                  <SiteArrow className="size-2.5" />
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
          )}
          <p className="mt-4 text-center text-sm text-zinc-600">
            {loggingIn
              ? "Don’t have an account? "
              : "Already have an account? "}
            {loggingIn ? (
              <a
                href={JOIN_MAILTO}
                className="font-medium text-black underline underline-offset-2"
              >
                Request an invite
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLoggingIn(true);
                  setError(null);
                  setNotice(null);
                }}
                className="font-medium text-black underline underline-offset-2"
              >
                Log in
              </button>
            )}
          </p>
          {!loggingIn && (
            <div className="mt-8">
              <InfoSessionButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
