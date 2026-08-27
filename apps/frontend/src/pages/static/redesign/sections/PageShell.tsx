import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import texture from "../../../../assets/redesign/priority-environment.jpg";
import type { RedesignPage } from "../links";
import { NavStart, themeVars, type RedesignTheme } from "../theme";
import { DisplayHeading, RD_COL } from "../ui";
import { JoinCta } from "./JoinCta";
import { Nav, NAV_HEIGHT } from "./Nav";
import { SiteFooter } from "./SiteFooter";

/** The three backgrounds a band can take, matching the home page's rhythm. */
export enum BandTone {
  Surface = "surface",
  SurfaceAlt = "surface-alt",
  Primary = "primary",
}

const bandClasses: Record<BandTone, string> = {
  [BandTone.Surface]: "bg-[var(--rd-surface)]",
  [BandTone.SurfaceAlt]: "bg-[var(--rd-surface-alt)]",
  [BandTone.Primary]: "bg-[var(--rd-primary)] text-white",
};

export function PageBand({
  tone = BandTone.Surface,
  children,
  className,
}: {
  tone?: BandTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={bandClasses[tone]}>
      <div className={cn(RD_COL, "py-16 lg:py-24", className)}>{children}</div>
    </section>
  );
}

/** Section heading for the interior pages: display face, primary, oversized. */
export function BandHeading({
  children,
  className,
  onDark = false,
}: {
  children: ReactNode;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <h2
      className={cn(
        "rd-headline text-[1.9rem] leading-tight sm:text-[2.4rem]",
        onDark ? "text-white" : "text-[var(--rd-primary)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function BandLede({
  children,
  className,
  onDark = false,
}: {
  children: ReactNode;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <p
      className={cn(
        "max-w-[46rem] text-[1.08rem] leading-snug sm:text-[1.2rem]",
        onDark ? "text-white/75" : "text-[var(--rd-ink)]/70",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Interior pages open on the primary band, textured like the milestone panel.
 * The page's name is the small label; the sentence under it carries the h1, so
 * what the page says outranks what it is called.
 */
function PageHeader({
  theme,
  title,
  lede,
}: {
  theme: RedesignTheme;
  title: string;
  lede?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--rd-primary)] text-white">
      {/* Desaturated photo screened over the tint, as in the milestone panel. */}
      <img
        src={texture}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 size-full object-cover"
        style={{
          mixBlendMode: "screen",
          filter: "grayscale(1) contrast(1.05)",
          opacity: 0.5,
        }}
      />
      <div
        className={cn(RD_COL, "flex flex-col gap-4 pb-16 lg:pb-20")}
        style={{ paddingTop: NAV_HEIGHT + 64 }}
      >
        <p className="text-[0.95rem] tracking-[0.14em] text-white/60 uppercase">
          {title}
        </p>
        <DisplayHeading
          theme={theme}
          as="h1"
          className="max-w-[64rem] text-white sm:text-[2.7rem] lg:text-[3.2rem]"
        >
          {lede ?? title}
        </DisplayHeading>
      </div>
    </section>
  );
}

/**
 * Every page behind the nav: the bar, a title block, the page's own bands, the
 * closing CTA, and the footer. The join page drops the CTA, since it already is
 * one.
 */
export function PageShell({
  theme,
  page,
  title,
  lede,
  children,
  showJoinCta = true,
}: {
  theme: RedesignTheme;
  page: RedesignPage;
  title: string;
  lede?: string;
  children: ReactNode;
  showJoinCta?: boolean;
}) {
  return (
    <div
      className="rd-root min-h-screen bg-[var(--rd-surface)] text-[var(--rd-ink)]"
      style={themeVars(theme)}
    >
      <Nav theme={theme} start={NavStart.Primary} current={page} />
      <PageHeader theme={theme} title={title} lede={lede} />
      <main>{children}</main>
      {showJoinCta && <JoinCta theme={theme} />}
      <SiteFooter theme={theme} />
    </div>
  );
}
