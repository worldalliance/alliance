import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import texture from "../assets/redesign/priority-environment.jpg";
import { useSiteBackground } from "../components/HtmlBackgroundManager";
import { SiteFooter } from "./Footer";
import { JoinCta } from "./JoinCta";
import { NAV_HEIGHT, Navbar } from "./Navbar";
import "./site.css";
import { siteVars } from "./tokens";
import { DisplayHeading, SITE_COL, SITE_H1 } from "./ui";

/**
 * The page root every public page sits inside: it carries the palette and the
 * faces as CSS variables, which everything below reads.
 */
export function SiteRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  useSiteBackground();

  return (
    <div
      className={cn(
        "site-root min-h-screen bg-[var(--site-surface)] text-[var(--site-ink)]",
        className,
      )}
      style={siteVars}
    >
      {children}
    </div>
  );
}

/** The three backgrounds a band can take, matching the home page's rhythm. */
export enum BandTone {
  Surface = "surface",
  SurfaceAlt = "surface-alt",
  Primary = "primary",
}

const bandClasses: Record<BandTone, string> = {
  [BandTone.Surface]: "bg-[var(--site-surface)]",
  [BandTone.SurfaceAlt]: "bg-[var(--site-surface-alt)]",
  [BandTone.Primary]: "bg-[var(--site-primary)] text-white",
};

export function PageBand({
  tone = BandTone.Surface,
  id,
  children,
  className,
}: {
  tone?: BandTone;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={bandClasses[tone]}>
      <div className={cn(SITE_COL, "py-16 lg:py-24", className)}>
        {children}
      </div>
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
        "site-display text-[1.9rem] leading-tight sm:text-[2.4rem]",
        onDark ? "text-white" : "text-[var(--site-primary)]",
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
        "max-w-[46rem] text-[1.05rem] leading-[1.65] sm:text-[1.12rem]",
        onDark ? "text-white/75" : "text-[var(--site-ink)]/70",
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
function PageHeader({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--site-primary)] text-white">
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
        className={cn(SITE_COL, "flex flex-col gap-4 pb-16 lg:pb-20")}
        style={{ paddingTop: NAV_HEIGHT + 64 }}
      >
        <p className="text-[0.95rem] tracking-[0.14em] text-white/60 uppercase">
          {title}
        </p>
        <DisplayHeading
          as="h1"
          className={cn(SITE_H1, "max-w-[64rem] text-white")}
        >
          {lede ?? title}
        </DisplayHeading>
      </div>
    </section>
  );
}

/**
 * Every page behind the nav: the bar, a title block, the page's own bands, the
 * closing CTA, and the footer. The join and partner pages drop the CTA, since
 * they already are one.
 */
export function PageShell({
  title,
  lede,
  children,
  showJoinCta = true,
}: {
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  showJoinCta?: boolean;
}) {
  return (
    <SiteRoot>
      <Navbar overPrimary />
      <PageHeader title={title} lede={lede} />
      <main>{children}</main>
      {showJoinCta && <JoinCta />}
      <SiteFooter />
    </SiteRoot>
  );
}
