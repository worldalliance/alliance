import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import heroImage from "../../../../assets/redesign/hero-image.jpg";
import { HERO_CTA, HERO_HEADLINE, HERO_SUBHEAD } from "../content";
import { NetworkAnimation } from "../graphics/NetworkAnimation";
import { NotificationRotator } from "../graphics/NotificationRotator";
import { NotificationStack } from "../graphics/NotificationStack";
import { HeroKind, type RedesignTheme } from "../theme";
import { RD_COL, RdButton } from "../ui";
import { NAV_HEIGHT } from "./Nav";

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
          <RdButton href="#join" tone="light" className="mt-2 w-fit" size="sm">
            {HERO_CTA}
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

const heroByKind: Record<
  HeroKind,
  (props: { theme: RedesignTheme }) => ReactNode
> = {
  [HeroKind.Photo]: PhotoHero,
  [HeroKind.Video]: VideoHero,
  [HeroKind.Network]: NetworkHero,
  [HeroKind.NotificationsOnly]: NotificationsOnlyHero,
};

export function Hero({ theme }: { theme: RedesignTheme }) {
  const Component = heroByKind[theme.hero];
  return <Component theme={theme} />;
}
