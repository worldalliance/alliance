import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { useSiteBackground } from "../components/HtmlBackgroundManager";
import { SiteFooter } from "./Footer";
import { JoinCta } from "./JoinCta";
import { NAV_HEIGHT, Navbar } from "./Navbar";
import "./site.css";
import { DisplayHeading, SITE_COL, SITE_H1 } from "./ui";

/** The page root every public page sits inside. */
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
        "site-display text-4xl leading-tight sm:text-5xl",
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
        "max-w-[46rem] text-lg leading-[1.65] sm:text-xl",
        onDark ? "text-white/75" : "text-[var(--site-ink)]/70",
        className,
      )}
    >
      {children}
    </p>
  );
}

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: ReactNode;
}) {
  return (
    <header
      className={cn(SITE_COL, "flex flex-col gap-4")}
      style={{ paddingTop: NAV_HEIGHT + 64 }}
    >
      <DisplayHeading as="h1" className={SITE_H1}>
        {title}
      </DisplayHeading>
      {subtitle && <BandLede>{subtitle}</BandLede>}
    </header>
  );
}

/**
 * Every page behind the nav: the bar, a title block, the page's own bands, the
 * closing CTA, and the footer. The join and partner pages drop the CTA, since
 * they already are one.
 */
export function PageShell({
  title,
  subtitle,
  children,
  showJoinCta = true,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  showJoinCta?: boolean;
}) {
  return (
    <SiteRoot>
      <Navbar />
      <PageHeader title={title} subtitle={subtitle} />
      <main>{children}</main>
      {showJoinCta && <JoinCta />}
      <SiteFooter />
    </SiteRoot>
  );
}
