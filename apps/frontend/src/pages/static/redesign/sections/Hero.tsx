import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import heroImage from "../../../../assets/redesign/hero-image.jpg";
import { HERO_HEADLINE, HERO_SUBHEAD } from "../content";
import { NetworkAnimation } from "../graphics/NetworkAnimation";
import { NotificationRotator } from "../graphics/NotificationRotator";
import { NotificationStack } from "../graphics/NotificationStack";
import { PostCollage } from "../graphics/PostCollage";
import { PostMarquee } from "../graphics/PostMarquee";
import { PostSpotlight } from "../graphics/PostSpotlight";
import { HeroKind, type RedesignTheme } from "../theme";
import { RD_COL, RdButton } from "../ui";
import { useJoinTarget } from "./JoinRequest";
import { NAV_HEIGHT } from "./Nav";
import { OVERLAP_CLEARANCE } from "./Priorities";

function Headline({
  theme,
  className,
}: {
  theme: RedesignTheme;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "rd-headline text-[2.6rem] leading-[1.07] sm:text-[3.6rem] lg:text-[4.4rem]",
        className,
      )}
      style={{ fontWeight: theme.headlineWeight }}
    >
      {HERO_HEADLINE}
    </h1>
  );
}

/** Photo and video heroes share everything but the media element. */
function MediaHero({
  theme,
  media,
}: {
  theme: RedesignTheme;
  media: ReactNode;
}) {
  const joinTarget = useJoinTarget(theme.version);

  return (
    <section className="relative isolate overflow-hidden text-white">
      <div className="absolute inset-0 -z-20">{media}</div>
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-black/25 via-transparent to-black/15"
        aria-hidden
      />
      <div
        className={cn(
          RD_COL,
          "flex min-h-[680px] flex-col justify-center pt-32 pb-52 lg:min-h-[820px]",
        )}
      >
        <div className="flex max-w-[52rem] flex-col gap-6">
          <Headline theme={theme} />
          <p className="max-w-[44rem] text-lg leading-snug font-light sm:text-[1.6rem]">
            {HERO_SUBHEAD}
          </p>
          <RdButton
            {...joinTarget}
            tone="light"
            className="mt-2 w-fit"
            size="sm"
          >
            {theme.joinLabel}
          </RdButton>
        </div>
      </div>
      {/* Clear of the priority row, which overlaps the bottom of the hero. */}
      <div className={cn(RD_COL, "absolute inset-x-0 bottom-[150px]")}>
        <NotificationRotator bare={theme.notificationsBare} onDark />
      </div>
    </section>
  );
}

function PhotoHero({ theme }: { theme: RedesignTheme }) {
  return (
    <MediaHero
      theme={theme}
      media={
        <img
          src={heroImage}
          alt="A solar farm and wind turbines at sunrise"
          className="size-full object-cover"
          loading="eager"
        />
      }
    />
  );
}

function VideoHero({ theme }: { theme: RedesignTheme }) {
  return (
    <MediaHero
      theme={theme}
      media={
        <video
          className="size-full object-cover"
          src="/assets/redesign/hero-video.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
      }
    />
  );
}

/**
 * Landing 3. The lattice hub sits directly under the copy, where a button would
 * otherwise go, so the artwork reads as the page's focal point.
 */
function NetworkHero({ theme }: { theme: RedesignTheme }) {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--rd-surface)]">
      <NetworkAnimation
        className="absolute inset-0 -z-10 size-full"
        hubYFraction={0.63}
      />
      <div
        className={cn(RD_COL, "flex flex-col items-center gap-5 text-center")}
        style={{ paddingTop: NAV_HEIGHT + 56 }}
      >
        <Headline
          theme={theme}
          className="max-w-[46rem] text-[var(--rd-primary)]"
        />
        <p className="max-w-[38rem] text-lg leading-snug text-[var(--rd-ink)]/85 sm:text-[1.6rem]">
          {HERO_SUBHEAD}
        </p>
      </div>
      {/* Room for the hub, then the activity row above the priority overlap. */}
      <div className={cn(RD_COL, "pt-[190px] pb-40")}>
        <NotificationRotator bare={theme.notificationsBare} />
      </div>
    </section>
  );
}

/**
 * Version 4. The notification animation is the whole hero; the headline block
 * below it carries the h1, matching the Landing 2 layout.
 */
function NotificationsOnlyHero() {
  return (
    <section className="bg-[var(--rd-surface)]">
      <div
        className={cn(RD_COL, "flex flex-col items-center pb-24 lg:pb-32")}
        style={{ paddingTop: `calc(${NAV_HEIGHT + 72}px + 5vh)` }}
      >
        <NotificationStack />
      </div>
    </section>
  );
}

/**
 * Landing 5. A row of member posts runs under the bar and off both edges of the
 * page, so the first thing anyone reads is what members have already finished.
 * The headline follows in a block below, as in version 4.
 */
function PostsMarqueeHero() {
  return (
    <section className="bg-[var(--rd-surface)]">
      <div
        className="pb-20 lg:pb-28"
        style={{ paddingTop: NAV_HEIGHT + 76 }}
      >
        <PostMarquee />
      </div>
    </section>
  );
}

/**
 * Landing 6. Headline and subhead hold the left column while a row of activity
 * runs beside them, each card larger than the last and the third off the page.
 */
function PostsCollageHero({ theme }: { theme: RedesignTheme }) {
  return (
    <section className="overflow-hidden bg-[var(--rd-surface)]">
      <div
        className={cn(
          RD_COL,
          "grid items-center gap-12 pb-24 lg:grid-cols-[1.15fr_1.3fr] lg:gap-16 lg:pb-32",
          OVERLAP_CLEARANCE,
        )}
        style={{ paddingTop: NAV_HEIGHT + 104 }}
      >
        <div className="flex flex-col gap-5">
          <Headline
            theme={theme}
            className="text-[var(--rd-primary)] sm:text-[3rem] lg:text-[3.6rem]"
          />
          <p className="max-w-[32rem] text-lg leading-snug text-[var(--rd-ink)] sm:text-[1.35rem]">
            {HERO_SUBHEAD}
          </p>
        </div>
        <PostCollage className="min-w-0" />
      </div>
    </section>
  );
}

/**
 * Landing 7. A centred headline over the video, then the supporting copy on a
 * panel cut into it, with a card either side.
 */
function PostsSpotlightHero({ theme }: { theme: RedesignTheme }) {
  return (
    <section className="relative isolate overflow-hidden text-white">
      <video
        className="absolute inset-0 -z-20 size-full object-cover"
        src="/assets/redesign/hero-video.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-[var(--rd-primary)]/45"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-black/35 to-transparent"
        aria-hidden
      />
      <div
        className={cn(RD_COL, OVERLAP_CLEARANCE)}
        style={{ paddingTop: NAV_HEIGHT + 64 }}
      >
        <Headline
          theme={theme}
          className="mx-auto max-w-[20ch] text-center text-white [text-shadow:0_2px_18px_rgba(4,14,32,0.45)]"
        />
        <div className="mt-14 lg:mt-20">
          <PostSpotlight theme={theme} />
        </div>
      </div>
    </section>
  );
}

const heroByKind: Record<
  HeroKind,
  (props: { theme: RedesignTheme }) => ReactNode
> = {
  [HeroKind.Photo]: PhotoHero,
  [HeroKind.Video]: VideoHero,
  [HeroKind.Network]: NetworkHero,
  [HeroKind.NotificationsOnly]: NotificationsOnlyHero,
  [HeroKind.PostsMarquee]: PostsMarqueeHero,
  [HeroKind.PostsCollage]: PostsCollageHero,
  [HeroKind.PostsSpotlight]: PostsSpotlightHero,
};

export function Hero({ theme }: { theme: RedesignTheme }) {
  const Component = heroByKind[theme.hero];
  return <Component theme={theme} />;
}
