import { AnalyticsEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
import { withCount } from "@alliance/common/plural";
import {
  authMe,
  authRegister,
  ProfileDto,
  ReferrerProfileDto,
  SignUpDto,
  userOnetimeInvite,
  userReferrerProfile,
  userSignupSocialProof,
} from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { Features } from "@alliance/shared/lib/features";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useQuery } from "@tanstack/react-query";
import posthog from "posthog-js";
import React, { useEffect, useMemo, useState } from "react";
import { href, Link, useSearchParams } from "react-router";
import SignupForm from "../../components/SignupForm";
import { isFeatureEnabled } from "../../lib/config";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { HERO_SUBHEAD } from "../../site/content";
import { SiteFooter } from "../../site/Footer";
import { LOGIN_HREF } from "../../site/links";
import { NAV_HEIGHT, Navbar } from "../../site/Navbar";
import { SiteRoot } from "../../site/PageShell";
import { LandingBody } from "../../site/sections/LandingBody";
import {
  DisplayHeading,
  DisplaySubtitle,
  SITE_COL,
  SiteArrow,
} from "../../site/ui";

function formatSignupSocialProofNames(
  profiles: Pick<ProfileDto, "displayName">[],
  totalMemberCount: number,
): string {
  const names = profiles.map((p) => p.displayName);
  const n = names.length;
  if (n === 0) return "";
  if (n === 1) return names[0];
  if (n === 2) return `${names[0]} and ${names[1]}`;
  if (n === 3) {
    return `${names[0]}, ${names[1]}, and ${names[2]}`;
  }
  const namesShown = 3;
  const others = Math.max(0, totalMemberCount - namesShown);
  return `${names[0]}, ${names[1]}, ${names[2]} and ${withCount(others, "other")}`;
}

export function meta() {
  return socialPreviewMeta({
    title: "Create an account — The Alliance",
    description:
      "Join a global community cooperating to improve the world. Members spend 15 minutes a week completing thoughtfully designed actions for measurable impact.",
    url: "/signup",
  });
}

function GrantmakingCard() {
  return (
    <Link
      to={href("/projects/democratic-grantmaking-26")}
      className="group flex min-h-80 flex-col justify-end bg-[var(--site-primary)] p-7 text-left text-white transition-colors hover:bg-[var(--site-primary-hover)] sm:min-h-96 sm:p-9 lg:h-full lg:min-h-[36rem]"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <p className="text-base text-white/40 md:text-lg">
        Upcoming project in fall 2026
      </p>
      <DisplayHeading
        as="h2"
        className="mt-4 text-balance text-4xl text-white sm:text-5xl lg:text-6xl"
      >
        Where should we donate <span className="text-green">$100,000</span>?
      </DisplayHeading>
      <p className="mt-6 text-lg leading-snug text-white/90 sm:text-xl">
        As a member, you will be able to help us direct a significant grant.
      </p>
      <span className="mt-10 flex items-end justify-between gap-4">
        <span className="text-lg text-white/80 sm:text-xl">
          <span className="font-semibold text-green">$11,200</span> committed so
          far
        </span>
        <SiteArrow className="mb-1 size-5 shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-1" />
      </span>
    </Link>
  );
}

const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const referralCode = searchParams.get("ref");
  const isPreviewMode = useMemo(() => {
    const p = searchParams.get("preview");
    return p === "1" || p === "true";
  }, [searchParams]);

  const { data: memberCount } = useAllianceMemberCount({
    enabled: isFeatureEnabled(Features.PublicSignup) || Boolean(referralCode),
  });

  const { data: signupSocialProof, isPending: signupSocialProofPending } =
    useQuery({
      queryKey: ["user", "signupSocialProof", referralCode ?? ""],
      queryFn: () =>
        userSignupSocialProof({
          query: referralCode ? { code: referralCode } : {},
        }).then((res) => res.data ?? null),
      enabled: isFeatureEnabled(Features.PublicSignup) || Boolean(referralCode),
    });

  const [inviterProfile, setInviterProfile] =
    useState<ReferrerProfileDto | null>(null);
  const [isInviteValid, setIsInviteValid] = useState(true);

  useEffect(() => {
    if (!referralCode) return;
    userReferrerProfile({ path: { code: referralCode } }).then((response) => {
      setInviterProfile(response.data ?? null);
    });

    userOnetimeInvite({ path: { code: referralCode } }).then((response) => {
      if (response.data) {
        setIsInviteValid(response.data.status !== "link_used");
      }
    });

    if (isPreviewMode) {
      return;
    }
    posthog.register_once({
      referral_code: referralCode,
    });
    captureEvent(AnalyticsEvent.InvitePageOpened, {
      referral_code: referralCode,
    });
  }, [referralCode, isPreviewMode]);

  const handleSubmit = async (formData: SignUpDto) => {
    if (isPreviewMode) {
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const resp = await authRegister({ body: formData });
      if (resp.response.ok) {
        const checkAuth = await authMe();

        if (checkAuth.response.ok) {
          const user = checkAuth.data?.user;
          if (user) {
            posthog.identify(user.id.toString(), {
              email: user.email,
              name: user.name,
              referral_code: referralCode,
            });
          }
          window.location.href = href("/tasks");
        } else {
          setError("please try again");
        }
      } else {
        setError(
          errorMessage({ error: resp.error, fallback: "Registration failed" }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inviteOnly = !isFeatureEnabled(Features.PublicSignup) && !referralCode;

  let inviterLine: React.ReactNode = null;
  if (!inviteOnly && isInviteValid && inviterProfile) {
    switch (inviterProfile.kind) {
      case "campaign":
        break;
      case "user":
        inviterLine = (
          <div className="flex flex-row items-center gap-x-2 text-[var(--site-ink)]/70">
            <AvatarProfile
              pfp={inviterProfile.profilePicture ?? null}
              size="small"
              className="inline-block"
            />
            <span>
              <span className="font-medium text-[var(--site-ink)]">
                {inviterProfile.displayName}
              </span>{" "}
              invited you to the Alliance
            </span>
          </div>
        );
        break;
      default:
        inviterProfile.kind satisfies never;
    }
  }

  return (
    <SiteRoot>
      <Navbar />
      <section
        id="create-account"
        className="bg-[var(--site-surface)]"
        style={{ paddingTop: NAV_HEIGHT }}
      >
        <div
          className={cn(
            SITE_COL,
            "flex flex-col gap-8 pt-12 pb-16 lg:pt-16 lg:pb-24",
          )}
        >
          {isPreviewMode && (
            <p className="border border-[var(--site-ink)]/15 bg-[var(--site-surface-alt)] px-4 py-3 text-sm text-[var(--site-ink)]/80">
              Preview: this is what people will see when they sign up with your
              invite link.
            </p>
          )}
          <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
            <div className="flex flex-col items-start gap-6">
              {inviterLine}
              <div className="flex flex-col items-start gap-4">
                <DisplayHeading as="h1" className="text-4xl sm:text-5xl">
                  {inviteOnly
                    ? "The Alliance is currently invite-only"
                    : "Create an account"}
                </DisplayHeading>
                <DisplaySubtitle>
                  {inviteOnly
                    ? "If you received an invite link, please use it to sign up."
                    : HERO_SUBHEAD}
                </DisplaySubtitle>
              </div>
              {error && (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {error}
                </p>
              )}
              {!inviteOnly && isInviteValid && (
                <>
                  {(signupSocialProofPending ||
                    (signupSocialProof?.profiles?.length ?? 0) > 0) && (
                    <div className="flex min-h-9 flex-col items-start gap-2 sm:flex-row sm:items-center">
                      <div className="flex shrink-0 flex-row items-center">
                        {signupSocialProofPending
                          ? null
                          : signupSocialProof?.profiles.map((p, i) => (
                              <div
                                key={p.id}
                                className={
                                  i > 0
                                    ? "-ml-1.5 relative z-0 rounded-sm ring-2 ring-[var(--site-surface)]"
                                    : "relative z-0 rounded-sm ring-2 ring-[var(--site-surface)]"
                                }
                                style={{ zIndex: i }}
                              >
                                <AvatarProfile
                                  pfp={p.profilePicture ?? null}
                                  size="small"
                                  className="inline-block"
                                />
                              </div>
                            ))}
                      </div>
                      <p className="text-sm leading-snug text-[var(--site-ink)]/60">
                        {signupSocialProofPending
                          ? "…"
                          : "Join " +
                            formatSignupSocialProofNames(
                              signupSocialProof?.profiles ?? [],
                              memberCount ?? 100,
                            )}
                      </p>
                    </div>
                  )}
                  <div
                    className="w-full bg-zinc-100 p-7 text-left sm:p-9"
                    style={{ borderRadius: "var(--site-radius-card)" }}
                  >
                    <SignupForm
                      onSubmit={handleSubmit}
                      loading={loading}
                      referralCode={referralCode}
                      disabled={isPreviewMode}
                    />
                  </div>
                  {!referralCode && (
                    <p className="text-sm text-[var(--site-ink)]/60">
                      Already have an account?{" "}
                      <Link to={LOGIN_HREF} className="text-[var(--site-link)]">
                        Log in
                      </Link>
                    </p>
                  )}
                </>
              )}
              {!inviteOnly && !isInviteValid && (
                <div className="flex flex-col gap-4 text-lg leading-snug text-[var(--site-ink)]/80">
                  <p className="font-medium text-[var(--site-ink)]">
                    You were sent an invite that has already been used.
                  </p>
                  <p>
                    If you haven&apos;t created an account yet, please reach out
                    to whoever invited you for a new invite code.
                  </p>
                  <p>
                    If you already have an account, please{" "}
                    <Link to={LOGIN_HREF} className="text-[var(--site-link)]">
                      log in
                    </Link>
                    .
                  </p>
                </div>
              )}
            </div>
            <GrantmakingCard />
          </div>
        </div>
      </section>
      {!inviteOnly && isInviteValid && <LandingBody />}
      <SiteFooter />
    </SiteRoot>
  );
};

export default SignupPage;
