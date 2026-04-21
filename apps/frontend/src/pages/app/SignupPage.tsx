import {
  authMe,
  authRegister,
  ProfileDto,
  SignUpDto,
  userFindOne,
  userNmembers,
  userOnetimeInvite,
  userReferrerProfile,
  userSignupSocialProof,
} from "@alliance/shared/client";
import { Features } from "@alliance/shared/lib/features";
import Card from "@alliance/sharedweb/ui/Card";
import posthog from "posthog-js";
import React, { useEffect, useMemo, useState } from "react";
import { Link, href, useSearchParams } from "react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import SignupForm from "../../components/SignupForm";
import { isFeatureEnabled } from "../../lib/config";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";

import { CardStyle } from "@alliance/shared/styles/card";
import ExamplePriorityCardList from "../../components/ExamplePriorityCardList";
import FeaturedImpactCard from "../../components/FeaturedImpactCard";
import { FEATURED_IMPACT_ACTIONS } from "../../content/featuredImpactActions";
import { ChevronRight } from "lucide-react";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import Footer from "../../components/Footer";

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
  return `${names[0]}, ${names[1]}, ${names[2]} and ${others} ${others === 1 ? "other" : "others"}`;
}

const memberQuotes = [
  {
    quote:
      "On the whole, the world is not going in the right direction. We need new ideas to change that, and the Alliance is just that. But it will work only if we all participate.",
    author:
      "Janos Pasztor, former UN Assistant Secretary-General for Climate Change",
    userId: 33,
  },
  {
    quote: (
      <span>
        For a few years now, I&apos;ve been thinking about contributing back to
        society and the world and what cause I should get behind. There are so
        many possibilities - food security, climate change, poverty, housing,
        education, all are worthy. But one thing I kept thinking was that
        contributing to any one of these causes has minimal individual level
        impact. How can I amplify or have a greater impact?
        <br />
        <br />I am convinced that the Alliance offers that platform and my
        opportunity for maximizing the impact of my time and energy contribution
        to the world over time. I want to be part of it and grow with it. They
        take your commitment seriously and will hold your feet to the fire. But
        it&apos;s just a few minutes per week and l&apos;ve found every project
        thus far to be self-enriching and meaningful.
      </span>
    ),

    author: "Sameer Vaidya, Alliance member",
    userId: 96,
  },
];

const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const referralCode = searchParams.get("ref");
  const isPreviewMode = useMemo(() => {
    const p = searchParams.get("preview");
    return p === "1" || p === "true";
  }, [searchParams]);

  const { data: memberCount } = useQuery({
    queryKey: ["userNmembers"],
    queryFn: () => userNmembers().then((res) => res.data ?? 0),
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

  const quoteUserIds = useMemo(
    () => [...new Set(memberQuotes.map((q) => q.userId))],
    [],
  );

  const quoteProfileQueries = useQueries({
    queries: quoteUserIds.map((userId) => ({
      queryKey: ["user", "slug", userId] as const,
      queryFn: () =>
        userFindOne({ path: { id: userId } }).then((res) => res.data ?? null),
      staleTime: 60 * 60 * 1000,
      enabled:
        (isFeatureEnabled(Features.PublicSignup) || Boolean(referralCode)) &&
        quoteUserIds.length > 0,
    })),
  });

  const quotePfpByUserId = new Map(
    quoteUserIds.map((id, i) => [
      id,
      quoteProfileQueries[i]?.data?.profilePicture ?? null,
    ]),
  );

  const [inviterProfile, setInviterProfile] = useState<ProfileDto | null>(null);
  // const [inviteeName, setInviteeName] = useState<string | null>(null);
  const [isInviteValid, setIsInviteValid] = useState(true);

  useEffect(() => {
    if (!referralCode) return;
    userReferrerProfile({ path: { code: referralCode } }).then((response) => {
      setInviterProfile(response.data ?? null);
    });

    userOnetimeInvite({ path: { code: referralCode } }).then((response) => {
      if (response.data) {
        // setInviteeName(response.data.invitee);
        setIsInviteValid(response.data.status !== "link_used");
      }
    });

    if (isPreviewMode) {
      return;
    }
    posthog.register_once({
      referral_code: referralCode,
    });
    posthog.capture("invite_page_opened", {
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
            posthog.capture("new_user", {
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
        setError((resp.error as Error).message || "Registration failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isFeatureEnabled(Features.PublicSignup) && !referralCode) {
    return (
      <div className="min-h-screen flex flex-col bg-page">
        <div className="flex flex-col grow items-center justify-center ">
          <div className="w-full max-w-md px-8">
            <p className="font-bold !mb-2">
              The Alliance is currently invite-only.
            </p>
            <p>If you received an invite link, please use it to sign up.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-8 py-12 lg:py-16 flex flex-col gap-y-12 lg:gap-y-16">
        <section className="flex flex-col gap-y-6">
          {isPreviewMode && (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Preview: this is what people will see when they sign up with your
              invite link.
            </p>
          )}
          {isInviteValid && inviterProfile && (
            <div className="rounded-md">
              <div className="flex flex-row gap-x-1 items-center text-zinc-500">
                <span>Invited by </span>
                <AvatarProfile
                  pfp={inviterProfile?.profilePicture ?? null}
                  size="small"
                  className="ml-1 inline-block text-green"
                />
                <span className="font-medium">
                  {inviterProfile?.displayName}
                </span>
              </div>
            </div>
          )}

          {error && (
            <Card style={CardStyle.Alert} className="border-red-400 bg-red-50">
              <span className="text-red-700">{error}</span>
            </Card>
          )}

          <div className="relative">
            {isInviteValid ? (
              <div>
                <h2
                  className="font-semibold text-3xl md:text-4xl font-serif mb-2"
                  id="create-account"
                >
                  Create an account
                </h2>
                <p className="text-lg md:text-xl text-zinc-500">
                  The Alliance is a global community of people cooperating to
                  improve the world. We&apos;re in an early, experimental
                  phase—membership is invite-only.
                </p>
                {(signupSocialProofPending ||
                  (signupSocialProof?.profiles?.length ?? 0) > 0) && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 mt-3 min-h-9">
                    <div className="flex flex-row items-center shrink-0">
                      {signupSocialProofPending
                        ? null
                        : signupSocialProof?.profiles.map((p, i) => (
                            <div
                              key={p.id}
                              className={
                                i > 0
                                  ? "-ml-1.5 ring-2 ring-white rounded-sm z-0 relative"
                                  : "ring-2 ring-white rounded-sm z-0 relative"
                              }
                              style={{ zIndex: i }}
                            >
                              <AvatarProfile
                                pfp={p.profilePicture ?? null}
                                size="small"
                                className="inline-block text-green"
                              />
                            </div>
                          ))}
                    </div>
                    <p className="text-sm text-zinc-500 leading-snug">
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
                <div className="mt-6">
                  <SignupForm
                    onSubmit={handleSubmit}
                    loading={loading}
                    referralCode={referralCode}
                    disabled={isPreviewMode}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col">
                <p className="font-semibold">
                  You were sent an invite that has already been used.
                </p>
                <p>
                  If you haven&apos;t created an account yet, please reach out
                  to whoever invited you for a new invite code.
                </p>
                <p>
                  If you already have an account, please{" "}
                  <Link to={href("/login")} className="text-link">
                    log in
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>

          {!referralCode && (
            <div className="text-center sm:text-left">
              <p className="text-[11pt] text-zinc-600">
                Already have an account?{" "}
                <Link
                  to={href("/login")}
                  className="text-green hover:underline"
                >
                  Log in
                </Link>
              </p>
            </div>
          )}
        </section>

        <section className="flex flex-col">
          <div className="flex flex-col gap-y-8 md:gap-y-14">
            <div className="flex flex-col">
              <h2 className="font-semibold text-2xl md:text-3xl font-serif mb-2">
                Easy, tangible impact
              </h2>
              <div className="flex flex-col mb-6">
                <p className="text-lg md:text-xl text-zinc-500">
                  <Link to={href("/progress")}>
                    Members participate in actions that take 15 minutes a week.
                    Our full-time team strives to plan actions that have a
                    clear, measurable impact.
                  </Link>
                </p>
              </div>
              <div className="flex flex-col gap-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FEATURED_IMPACT_ACTIONS.map((action) => (
                    <FeaturedImpactCard key={action.actionId} {...action} />
                  ))}
                </div>
              </div>
              <Link
                to={href("/progress")}
                className="whitespace-nowrap text-link text-base md:text-lg flex flex-row items-center gap-x-1 w-fit"
              >
                See more
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex flex-col">
              <h2 className="font-semibold text-2xl md:text-3xl font-serif mb-2">
                Focus on global crises
              </h2>
              <div className="flex flex-row gap-3 mb-6">
                <p className="text-lg md:text-xl text-zinc-500">
                  <Link to={href("/progress")}>
                    We prioritize problems that cause enormous, irreversible
                    harm.
                  </Link>
                </p>
              </div>
              <ExamplePriorityCardList dropdown />
            </div>
            <div className="flex flex-col">
              <h2 className="font-semibold text-2xl md:text-3xl font-serif mb-2">
                Commited community
              </h2>
              <p className="text-zinc-500 text-lg md:text-xl mb-6">
                We ask members to show up consistently so that we can develop
                precise, effective action plans in advance.
              </p>
              <div className="flex flex-col gap-y-2">
                {memberQuotes.map((memberQuote, index) => (
                  <div
                    className="text-base lg:text-lg bg-white p-4 sm:p-6 rounded-md border border-grey-1"
                    key={`${memberQuote.userId}-${index}`}
                  >
                    <p>{memberQuote.quote}</p>
                    <div className="flex flex-row items-center gap-x-2 mt-2">
                      <AvatarProfile
                        pfp={quotePfpByUserId.get(memberQuote.userId) ?? null}
                        size="small"
                        className="ml-1 inline-block text-green"
                      />
                      <span className="text-zinc-500">
                        {memberQuote.author}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="font-semibold text-2xl md:text-3xl font-serif mb-2">
                Help us grow
              </h2>
              <p className="text-zinc-500 text-lg md:text-xl mb-6">
                You were invited because a current member of the Alliance
                believes you are a good fit for our community. The more people
                who join us, the more impact we will be able to achieve, and the
                better we can test our processes and strategies.
              </p>
              <p className="text-zinc-500 text-lg md:text-xl mb-6">
                Once we reach around 10,000 members, we will launch publicly.
                You can read more about our roadmap on our{" "}
                <Link to={href("/guide")} className="text-link">
                  guide
                </Link>
                .
              </p>
              <a
                href="#create-account"
                className="bg-zinc-800 hover:bg-zinc-700 font-semibold text-center text-white px-6 py-4 rounded-md text-lg"
              >
                Join
              </a>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default SignupPage;
