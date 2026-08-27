import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import type { RedesignTheme } from "./theme";

export const RD_COL = "mx-auto w-full max-w-[1300px] px-5 sm:px-8 lg:px-[68px]";

/** Traced from `design/arrow-vector.svg` so the nav and CTA share one arrow. */
export function RdArrow({ className }: { className?: string }) {
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
 * The slab-and-tail quote glyph from the Figma assets, as a path so each version
 * can tint it. The two assets are a vertical mirror pair, not a rotation.
 */
export function RdQuoteMark({
  kind,
  className,
}: {
  kind: QuoteMarkKind;
  className?: string;
}) {
  const mark = "M0 0H40V38L18 79H0L22 38H0Z";
  return (
    <svg
      viewBox="0 0 90 79"
      className={cn("shrink-0", className)}
      style={
        kind === QuoteMarkKind.Open ? { transform: "scaleY(-1)" } : undefined
      }
      aria-hidden
    >
      <path d={mark} fill="currentColor" />
      <path d={mark} fill="currentColor" transform="translate(50 0)" />
    </svg>
  );
}

export function Logotype({
  theme,
  onDark = false,
  className,
}: {
  theme: RedesignTheme;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rd-display leading-none whitespace-nowrap",
        theme.logotypeUppercase && "uppercase",
        onDark ? "text-white" : "text-[var(--rd-primary)]",
        className,
      )}
      style={{
        fontWeight: theme.logotypeWeight,
        letterSpacing: theme.logotypeTracking,
      }}
    >
      {theme.logotypeArticle ? "The Alliance" : "Alliance"}
    </span>
  );
}

type ButtonTone = "primary" | "outline" | "light" | "outlineLight";

const toneClasses: Record<ButtonTone, string> = {
  primary:
    "bg-[var(--rd-primary)] text-white hover:bg-[var(--rd-primary-hover)] border border-transparent",
  outline:
    "bg-transparent text-[var(--rd-primary)] border border-[var(--rd-primary)]/35 hover:border-[var(--rd-primary)]/70",
  light:
    "bg-white text-[var(--rd-ink)] border border-transparent hover:bg-white/85",
  outlineLight:
    "bg-transparent text-white border border-white/60 hover:bg-white/10",
};

export function RdButton({
  children,
  tone = "primary",
  href,
  className,
  size = "base",
  withArrow = false,
}: {
  children: ReactNode;
  tone?: ButtonTone;
  href: string;
  className?: string;
  size?: "sm" | "base";
  withArrow?: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group/btn inline-flex items-center gap-2 font-medium",
        "transition-[background-color,border-color,transform,box-shadow] duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-12px_rgba(0,0,0,0.55)]",
        size === "sm"
          ? "min-h-11 px-4 py-2 text-sm"
          : "min-h-12 px-5 py-2.5 text-base",
        toneClasses[tone],
        className,
      )}
      style={{ borderRadius: "var(--rd-radius-button)" }}
    >
      {children}
      {withArrow && (
        <RdArrow className="size-2.5 transition-transform duration-300 ease-out group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
      )}
    </a>
  );
}

/**
 * Section h2. Body face at regular weight, matching the priority card titles.
 */
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
        onDark ? "text-white" : "text-[var(--rd-primary)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** The oversized display heading. Version 4 renders it as the page h1. */
export function DisplayHeading({
  children,
  theme,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  theme: RedesignTheme;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      className={cn(
        "rd-headline text-[2.5rem] leading-[1.06] text-[var(--rd-primary)] sm:text-[3.4rem] lg:text-[4.1rem]",
        className,
      )}
      style={{ fontWeight: theme.headlineWeight }}
    >
      {children}
    </Tag>
  );
}
