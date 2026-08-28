import { cn } from "@alliance/shared/styles/util";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import texture from "../assets/redesign/priority-environment.jpg";

export const SITE_COL =
  "mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-[68px]";

/**
 * The h1 size, shared by the hero and every page header behind the nav. Steps
 * DisplayHeading down from its own sm and lg sizes, keeping its 2.5rem base.
 */
export const SITE_H1 = "sm:text-6xl lg:text-7xl";

/** Both form submits: one box, and the fill is all that separates them. */
export const SITE_SUBMIT =
  "inline-flex min-h-12 w-fit items-center gap-2 px-5 text-base font-medium transition-colors disabled:opacity-60";

/**
 * A solid tinted card with a desaturated photo screened over it, which is the
 * treatment the milestone panel established.
 */
export function TexturedPanel({
  tint,
  children,
  className,
}: {
  tint: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden px-6 py-8 sm:px-[78px] sm:py-10",
        className,
      )}
      style={{
        borderRadius: "var(--site-radius-card)",
        backgroundColor: tint,
      }}
    >
      <img
        src={texture}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover"
        style={{
          mixBlendMode: "screen",
          filter: "grayscale(1) contrast(1.05)",
          opacity: 0.62,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Traced from `design/arrow-vector.svg` so the nav and CTA share one arrow. */
export function SiteArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M8.4127 2.69841L1.36905 9.7619C1.21032 9.92063 1.02169 10 0.803175 10C0.585185 10 0.396825 9.92063 0.238095 9.7619C0.0793648 9.60317 0 9.41455 0 9.19603C0 8.97804 0.0793648 8.78968 0.238095 8.63095L7.30159 1.5873H1.26984C1.04497 1.5873 0.856349 1.51138 0.703968 1.35952C0.552116 1.20714 0.47619 1.01852 0.47619 0.793651C0.47619 0.568783 0.552116 0.380159 0.703968 0.227778C0.856349 0.0759261 1.04497 0 1.26984 0H9.20635C9.43122 0 9.61958 0.0759261 9.77143 0.227778C9.92381 0.380159 10 0.568783 10 0.793651V8.73016C10 8.95503 9.92381 9.14339 9.77143 9.29524C9.61958 9.44762 9.43122 9.52381 9.20635 9.52381C8.98148 9.52381 8.79312 9.44762 8.64127 9.29524C8.48889 9.14339 8.4127 8.95503 8.4127 8.73016V2.69841Z"
        fill="currentColor"
      />
    </svg>
  );
}

export enum QuoteMarkKind {
  /** Slab low, tail up-left. `design/quotation down.png`. Opens a quote. */
  Open = "open",
  /** Slab high, tail down-left. `design/quotation up.png`. Closes a quote. */
  Close = "close",
}

/**
 * The slab-and-tail quote glyph from the Figma assets, as a path so it can be
 * tinted. The two assets are a vertical mirror pair, not a rotation.
 */
export function QuoteMark({
  kind,
  flipped = false,
  className,
}: {
  kind: QuoteMarkKind;
  /** Mirrors the glyph left to right, so a pair faces inward. */
  flipped?: boolean;
  className?: string;
}) {
  const mark = "M0 0H40V38L18 79H0L22 38H0Z";
  const scaleY = kind === QuoteMarkKind.Open ? -1 : 1;
  const scaleX = flipped ? -1 : 1;
  return (
    <svg
      viewBox="0 0 90 79"
      className={cn("shrink-0", className)}
      style={{ transform: `scale(${scaleX}, ${scaleY})` }}
      aria-hidden
    >
      <path d={mark} fill="currentColor" />
      <path d={mark} fill="currentColor" transform="translate(50 0)" />
    </svg>
  );
}

export function Logotype({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "site-display leading-none whitespace-nowrap",
        onDark ? "text-white" : "text-[var(--site-primary)]",
        className,
      )}
      style={{ fontWeight: 500, letterSpacing: "0.02em" }}
    >
      The Alliance
    </span>
  );
}

type ButtonTone = "primary" | "outline" | "light" | "outlineLight";

const toneClasses: Record<ButtonTone, string> = {
  primary:
    "bg-[var(--site-primary)] text-white hover:bg-[var(--site-primary-hover)] border border-transparent",
  outline:
    "bg-transparent text-[var(--site-link)] border border-[var(--site-link)]/40 hover:border-[var(--site-link)]/80",
  light:
    "bg-white text-[var(--site-ink)] border border-transparent hover:bg-white/85",
  outlineLight:
    "bg-transparent text-white border border-white/60 hover:bg-white/10",
};

/**
 * A control that either navigates or does something in place, so a call to
 * action can be either without its caller knowing which.
 */
export type LinkTarget = { to: string } | { onClick: () => void };

export function SiteButton({
  children,
  tone = "primary",
  className,
  size = "base",
  withArrow = false,
  ...target
}: {
  children: ReactNode;
  tone?: ButtonTone;
  className?: string;
  size?: "sm" | "base";
  withArrow?: boolean;
} & LinkTarget) {
  const classes = cn(
    "group/btn inline-flex items-center gap-2 font-medium",
    "transition-[background-color,border-color,transform,box-shadow] duration-300 ease-out",
    "hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-12px_rgba(0,0,0,0.55)]",
    size === "sm"
      ? "min-h-11 px-4 py-2 text-sm"
      : "min-h-12 px-5 py-2.5 text-base",
    toneClasses[tone],
    className,
  );
  const body = (
    <>
      {children}
      {withArrow && (
        <SiteArrow className="size-2.5 transition-transform duration-300 ease-out group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
      )}
    </>
  );
  const style = { borderRadius: "var(--site-radius-button)" };

  return "to" in target ? (
    <Link to={target.to} className={classes} style={style}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={target.onClick}
      className={classes}
      style={style}
    >
      {body}
    </button>
  );
}

/**
 * A link or a button, whichever the target calls for, with no styling of its
 * own — the closing call to action wraps a whole photo panel in one.
 */
export function SiteTrigger({
  children,
  className,
  style,
  ariaLabel,
  ...target
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
} & LinkTarget) {
  return "to" in target ? (
    <Link
      to={target.to}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  ) : (
    <button
      type="button"
      onClick={target.onClick}
      className={cn("text-left", className)}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export const SITE_INPUT =
  "w-full border border-[var(--site-ink)]/15 bg-white px-3.5 py-2.5 text-base text-[var(--site-ink)] outline-none transition-colors placeholder:text-[var(--site-ink)]/35 focus:border-[var(--site-primary)]";

export const SITE_INPUT_STYLE = { borderRadius: "var(--site-radius-input)" };

/** Label above the control, with the asterisk the required ones carry. */
export function SiteField({
  label,
  name,
  required = false,
  onDark = false,
  children,
  className,
}: {
  label: string;
  name: string;
  required?: boolean;
  /** Set where the field sits on a primary band rather than the surface. */
  onDark?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={name} className={cn("flex flex-col gap-1.5", className)}>
      <span
        className={cn(
          "text-sm font-medium",
          onDark ? "text-white/75" : "text-[var(--site-ink)]/70",
        )}
      >
        {label}
        {required && (
          <span
            className={onDark ? "text-white/50" : "text-[var(--site-primary)]"}
            aria-hidden
          >
            {" *"}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

/** Section h2. Body face at regular weight, matching the priority titles. */
export function SectionHeading({
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
        "text-[1.7rem] leading-tight font-normal sm:text-[2rem]",
        onDark ? "text-white" : "text-[var(--site-primary)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** The oversized display heading, which every page uses as its h1. */
export function DisplayHeading({
  children,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      className={cn(
        "site-display site-headline text-[var(--site-primary)] leading-[1.06] text-4xl sm:text-5xl lg:text-6xl",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
