import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { PROGRESS_SEGMENTS } from "./flow";

/** Staggers a screen's contents in, top to bottom. */
export function riseStyle(index: number): CSSProperties {
  return { animationDelay: `${120 + index * 110}ms` };
}

export function ProgressTrack({ filled }: { filled: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-5 z-20 grid gap-3 sm:inset-x-8 sm:gap-5 lg:inset-x-14"
      style={{
        bottom: "var(--ob-progress-bottom)",
        gridTemplateColumns: `repeat(${PROGRESS_SEGMENTS}, minmax(0, 1fr))`,
      }}
      aria-hidden
    >
      {Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className="h-[3px] overflow-hidden rounded-full bg-white/40"
        >
          <span
            className="block h-full origin-left rounded-full bg-white transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${i < filled ? 1 : 0})` }}
          />
        </span>
      ))}
    </div>
  );
}

export function StepEyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="ob-display ob-rise shrink-0 text-center text-[length:var(--ob-eyebrow)] text-white"
      style={riseStyle(0)}
    >
      {children}
    </p>
  );
}

export function StepHeadline({
  children,
  className,
  index = 1,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <h1
      className={cn(
        "ob-rise mx-auto max-w-[54rem] shrink-0 text-center text-[length:var(--ob-h1)] leading-[1.2] font-normal text-balance text-white",
        className,
      )}
      style={riseStyle(index)}
    >
      {children}
    </h1>
  );
}

const NAV_BUTTON = "min-h-11 gap-2 rounded-lg px-6 sm:min-w-[13rem]";

const NAV_PRIMARY = "border-transparent bg-white text-(--ob-tone-ink)";

const NAV_SECONDARY =
  "border-white/70 bg-transparent text-white hover:bg-white/10";

export function FooterNav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  index = 3,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  index?: number;
}) {
  return (
    <div
      data-ob-nav
      className="ob-rise mx-auto flex w-fit shrink-0 gap-3"
      style={{ ...riseStyle(index), marginTop: "var(--ob-band-gap)" }}
    >
      {onBack && (
        <Button
          color={ButtonColor.Outline}
          className={cn(NAV_BUTTON, NAV_SECONDARY)}
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
      )}
      <Button
        color={ButtonColor.WhiteBorderless}
        className={cn(NAV_BUTTON, NAV_PRIMARY)}
        onClick={onNext}
        disabled={nextDisabled}
      >
        {nextLabel}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function StepNote({
  children,
  className,
  index = 3,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <p
      className={cn(
        "ob-rise mx-auto max-w-[46rem] shrink-0 text-center text-[length:var(--ob-body)] leading-snug text-pretty text-white",
        className,
      )}
      style={riseStyle(index)}
    >
      {children}
    </p>
  );
}

export function StepLayout({
  eyebrow,
  children,
  footer,
  className,
}: {
  eyebrow?: string | null;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden px-5 sm:px-8 lg:px-[6.5%]",
        className,
      )}
      style={{
        paddingTop: "var(--ob-pad-top)",
        paddingBottom: "var(--ob-pad-bottom)",
      }}
    >
      {eyebrow && <StepEyebrow>{eyebrow}</StepEyebrow>}
      <div
        className="flex min-h-0 flex-1 flex-col justify-center"
        style={{
          gap: "var(--ob-gap)",
          marginTop: eyebrow ? "var(--ob-band-gap)" : undefined,
        }}
      >
        {children}
      </div>
      {footer}
    </div>
  );
}
