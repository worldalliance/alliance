import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  ReferrerProfileDto,
  userOnetimeInvite,
  userReferrerProfile,
} from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import posthog from "posthog-js";
import React, { useEffect, useState } from "react";
import { href, Link, useSearchParams } from "react-router";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { HERO_SUBHEAD } from "../../site/content";
import { SiteFooter } from "../../site/Footer";
import { JoinCta } from "../../site/JoinCta";
import { GUIDE_HREF } from "../../site/links";
import { NAV_HEIGHT, Navbar } from "../../site/Navbar";
import { SiteRoot } from "../../site/PageShell";
import { LandingBody } from "../../site/sections/LandingBody";
import {
  DisplayHeading,
  DisplaySubtitle,
  SITE_COL,
  SiteButton,
} from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Invitation to the Alliance",
    description:
      "A global group of people cooperating to improve the world. Members spend 15 minutes a week completing thoughtfully designed actions for measurable impact.",
    url: "/invite",
  });
}

const InvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const referralCode = searchParams.get("ref");

  const [inviterProfile, setInviterProfile] =
    useState<ReferrerProfileDto | null>(null);
  const [inviteeName, setInviteeName] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<number | null>(null);

  useEffect(() => {
    if (!referralCode) return;
    userReferrerProfile({ path: { code: referralCode } }).then((response) => {
      setInviterProfile(response.data ?? null);
    });

    userOnetimeInvite({ path: { code: referralCode } }).then((response) => {
      if (response.data) {
        setInviteeName(response.data.invitee);
        setCommunityId(response.data.community?.id ?? null);
      }
    });

    posthog.register_once({
      referral_code: referralCode,
    });
    captureEvent(AnalyticsEvent.InvitePageOpened, {
      referral_code: referralCode,
    });
  }, [referralCode]);

  if (!referralCode) {
    return (
      <SiteRoot>
        <Navbar />
        <section
          className="bg-[var(--site-surface)]"
          style={{ paddingTop: NAV_HEIGHT }}
        >
          <div
            className={cn(
              SITE_COL,
              "flex flex-col items-center gap-4 pt-16 pb-20 text-center lg:pt-24",
            )}
          >
            <DisplayHeading
              as="h1"
              className="text-4xl sm:text-5xl lg:text-6xl"
            >
              Invalid invite
            </DisplayHeading>
            <DisplaySubtitle className="mx-auto text-center">
              This invite link is missing a code.
            </DisplaySubtitle>
          </div>
        </section>
        <SiteFooter />
      </SiteRoot>
    );
  }

  const signupTo = `${href("/signup")}?ref=${referralCode}`;

  let inviterLine: React.ReactNode = null;
  if (inviterProfile) {
    switch (inviterProfile.kind) {
      case "campaign":
        break;
      case "user":
        inviterLine = (
          <span className="inline-flex items-center justify-center gap-2">
            From
            <AvatarProfile
              pfp={inviterProfile.profilePicture ?? null}
              size="small"
            />
            {inviterProfile.displayName}
          </span>
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
        className="bg-[var(--site-surface)]"
        style={{ paddingTop: NAV_HEIGHT }}
      >
        <div
          className={cn(
            SITE_COL,
            "flex flex-col items-center gap-8 pt-16 pb-16 text-center lg:pt-24 lg:pb-20",
          )}
        >
          {inviterLine && (
            <div className="text-lg text-[var(--site-ink)]/70">
              {inviterLine}
            </div>
          )}
          <div className="flex flex-col items-center gap-4">
            <DisplayHeading
              as="h1"
              className="text-4xl sm:text-5xl lg:text-6xl"
            >
              Invitation to the Alliance
            </DisplayHeading>
            <DisplaySubtitle className="mx-auto text-center">
              {HERO_SUBHEAD}
            </DisplaySubtitle>
          </div>
          <p className="max-w-xl text-lg leading-snug text-[var(--site-ink)]/80 sm:text-xl">
            {inviteeName ? `Hi ${inviteeName}, ` : ""}I invite you to join me as
            a member of the Alliance. I believe you share my concerns about the
            direction the world is headed, and membership is a straightforward
            way to take action.
          </p>
          <SiteButton to={signupTo} tone="primary" withArrow>
            Sign up
          </SiteButton>
          <ol className="flex max-w-xl list-decimal flex-col gap-3 pl-5 text-left text-lg leading-snug text-[var(--site-ink)]/80">
            <li>
              Skim our{" "}
              <Link
                to={GUIDE_HREF}
                target="_blank"
                className="text-[var(--site-link)]"
              >
                guide
              </Link>{" "}
              to understand our structure, process, and governance.
            </li>
            <li>
              Create an account with my{" "}
              <Link to={signupTo} className="text-[var(--site-link)]">
                personal sign-up link
              </Link>
              . We will be added as friends automatically.
              {communityId
                ? " You will also be added to my smaller Alliance group."
                : ""}
            </li>
            <li>
              Go through the onboarding tasks on your{" "}
              <Link
                to={href("/tasks")}
                target="_blank"
                className="text-[var(--site-link)]"
              >
                tasks page
              </Link>
              , which explain how our online process works and what is expected
              of members.
            </li>
          </ol>
        </div>
      </section>
      <LandingBody />
      <JoinCta to={signupTo} heading="Create an account" />
      <SiteFooter />
    </SiteRoot>
  );
};

export default InvitePage;
