import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import {
  COMMIT_CTA,
  COMMIT_PLACEHOLDER,
  COMMIT_PLEDGE,
  COMMIT_SIGNATURE,
  COMMIT_SIGNATURE_LABEL,
  COMMIT_STATEMENT,
  COMMIT_TITLE,
  TASK_CTA,
  TASK_PROGRESS_DONE,
  TASK_PROGRESS_TOTAL,
  TASK_SHORT_STEPS,
  TASK_STEPS,
  TASK_TITLE,
  UPDATE_AUTHOR,
  UPDATE_BODY,
  UPDATE_HEADLINE,
  UPDATE_TITLE_LABEL,
  UPDATE_TITLE_SHORT,
  testimonials,
} from "../content";
import { useInView, usePrefersReducedMotion } from "../hooks";

const CARD_H = "h-[236px]";

function MockCard({
  title,
  children,
  cardRef,
  className,
}: {
  title: string;
  children: ReactNode;
  cardRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div
      ref={cardRef}
      className={cn(
        "flex flex-col overflow-hidden border border-[var(--rd-ink)]/15 bg-white px-5 pt-4",
        CARD_H,
        className,
      )}
      style={{ borderRadius: "var(--rd-radius-card)" }}
    >
      <p className="mb-2.5 text-[1.02rem] leading-snug font-semibold text-[var(--rd-ink)]">
        {title}
      </p>
      {children}
    </div>
  );
}

function MockButton({ label }: { label: string }) {
  return (
    <div
      className="mt-auto mb-5 py-2.5 text-center text-sm font-medium text-white"
      style={{
        backgroundColor: "var(--rd-primary)",
        borderRadius: "var(--rd-radius-button)",
      }}
    >
      {label}
    </div>
  );
}

function useTypewriter(text: string, active: boolean, msPerChar = 34) {
  const [count, setCount] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, msPerChar);
    return () => clearInterval(id);
  }, [text, active, msPerChar, reduced]);

  return { typed: text.slice(0, count), done: count >= text.length };
}

export function CommitCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const { typed, done } = useTypewriter(COMMIT_STATEMENT, inView);

  return (
    <MockCard title={COMMIT_TITLE} cardRef={ref}>
      <p className="border-l-2 border-[var(--rd-accent)] bg-[var(--rd-ink)]/[0.06] px-3 py-2.5 text-[0.82rem] italic text-[var(--rd-ink)]/50">
        {COMMIT_STATEMENT}
      </p>
      <div
        className="mt-2.5 border border-[var(--rd-ink)]/20 px-3 py-2.5 text-[0.82rem]"
        style={{ borderRadius: "var(--rd-radius-input)" }}
      >
        {typed.length === 0 ? (
          <span className="text-[var(--rd-ink)]/40">{COMMIT_PLACEHOLDER}</span>
        ) : (
          <span className="text-[var(--rd-ink)]">
            {typed}
            {!done && (
              <span
                className="ml-px inline-block h-[1em] w-px translate-y-[0.15em] bg-[var(--rd-ink)]"
                style={{ animation: "rd-caret 1s steps(1) infinite" }}
                aria-hidden
              />
            )}
          </span>
        )}
      </div>
      <MockButton label={COMMIT_CTA} />
    </MockCard>
  );
}

export function TaskCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const reduced = usePrefersReducedMotion();
  const [checked, setChecked] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setChecked(2);
      return;
    }
    const timers = [
      setTimeout(() => setChecked(1), 480),
      setTimeout(() => setChecked(2), 1260),
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced]);

  return (
    <MockCard title={TASK_TITLE} cardRef={ref}>
      <ul className="flex flex-col gap-1">
        {TASK_STEPS.map((step, i) => {
          const isChecked = i < checked;
          const isCurrent = i === TASK_STEPS.length - 1;

          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-2.5 rounded px-2 py-1.5 text-[0.82rem]",
                isCurrent
                  ? "bg-[var(--rd-ink)]/[0.06] font-medium text-[var(--rd-ink)]"
                  : "text-[var(--rd-ink)]/85",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isChecked
                    ? "border-[var(--rd-accent)] bg-[var(--rd-accent)] text-white"
                    : "border-[var(--rd-accent)]/70",
                )}
              >
                {isChecked && (
                  <Check
                    className="size-2.5"
                    strokeWidth={3.5}
                    style={{ animation: "rd-check-pop 320ms ease-out" }}
                    aria-hidden
                  />
                )}
              </span>
              {step}
            </li>
          );
        })}
      </ul>
      <MockButton label={TASK_CTA} />
    </MockCard>
  );
}

/** The update panel is inset but runs past the card edge, as in the mockup. */
export function UpdateCard() {
  return (
    <MockCard title={UPDATE_TITLE_LABEL} className="pb-0">
      <div className="relative flex-1 overflow-hidden bg-[var(--rd-ink)]/[0.05] px-3.5 pt-3">
        <div className="flex items-center gap-2">
          <img
            src={testimonials[0].avatar}
            alt=""
            aria-hidden
            className="size-5 rounded object-cover"
          />
          <span className="text-[0.82rem] font-medium text-[var(--rd-ink)]">
            {UPDATE_AUTHOR}
          </span>
        </div>
        <p className="mt-2.5 text-[0.82rem] font-semibold text-[var(--rd-ink)]">
          {UPDATE_HEADLINE}
        </p>
        <p className="mt-2 text-[0.82rem] leading-snug text-[var(--rd-ink)]/75">
          {UPDATE_BODY}
        </p>
      </div>
    </MockCard>
  );
}

/**
 * Version 4's commitment card. The pledge is stated for the member and they only
 * sign it, which reads less like an exam than typing the sentence out.
 */
export function CommitSignatureCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const { typed, done } = useTypewriter(COMMIT_SIGNATURE, inView, 150);

  return (
    <MockCard title={COMMIT_TITLE} cardRef={ref}>
      <p className="border-l-2 border-[var(--rd-accent)] bg-[var(--rd-ink)]/[0.06] px-3 py-3 text-[0.88rem] leading-snug text-[var(--rd-ink)]/80">
        {COMMIT_PLEDGE}
      </p>
      <p className="mt-4 text-[0.72rem] tracking-wide text-[var(--rd-ink)]/45 uppercase">
        {COMMIT_SIGNATURE_LABEL}
      </p>
      {/*
       * The row owns the remaining height and the glyphs sit on its baseline, so
       * ascenders and descenders appearing mid-word can't shift the layout.
       */}
      <div className="mt-auto mb-5 flex flex-1 items-end border-b border-[var(--rd-ink)]/25">
        <span className="rd-signature flex h-[2.9rem] items-end pb-1 text-[2.9rem] leading-none whitespace-nowrap text-[var(--rd-ink)]">
          {typed}
          {!done && (
            <span
              className="mb-[0.45rem] ml-0.5 inline-block h-[1.4rem] w-px shrink-0 bg-[var(--rd-ink)]"
              style={{ animation: "rd-caret 1s steps(1) infinite" }}
              aria-hidden
            />
          )}
        </span>
      </div>
    </MockCard>
  );
}

/** Version 4's action card: two steps, and how many members have finished. */
export function TaskProgressCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const reduced = usePrefersReducedMotion();
  const [checked, setChecked] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setChecked(TASK_SHORT_STEPS.length);
      return;
    }
    const timers = [
      setTimeout(() => setChecked(1), 560),
      setTimeout(() => setChecked(2), 1240),
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced]);

  const percent = Math.round((TASK_PROGRESS_DONE / TASK_PROGRESS_TOTAL) * 100);

  return (
    <MockCard title={TASK_TITLE} cardRef={ref}>
      <div className="flex flex-col gap-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--rd-ink)]/12">
          <div
            className="h-full origin-left rounded-full bg-[var(--rd-accent)] transition-transform duration-[900ms] ease-out"
            style={{ transform: `scaleX(${inView ? percent / 100 : 0})` }}
          />
        </div>
        <p className="text-[0.78rem] text-[var(--rd-ink)]/60">
          {TASK_PROGRESS_DONE}/{TASK_PROGRESS_TOTAL} members have completed the
          task
        </p>
      </div>

      <ul className="mt-3.5 flex flex-col gap-1">
        {TASK_SHORT_STEPS.map((step, i) => {
          const isChecked = i < checked;
          return (
            <li
              key={step}
              className="flex items-center gap-2.5 rounded bg-[var(--rd-ink)]/[0.06] px-2 py-1.5 text-[0.82rem] font-medium text-[var(--rd-ink)]"
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isChecked
                    ? "border-[var(--rd-accent)] bg-[var(--rd-accent)] text-white"
                    : "border-[var(--rd-accent)]/70",
                )}
              >
                {isChecked && (
                  <Check
                    className="size-2.5"
                    strokeWidth={3.5}
                    style={{ animation: "rd-check-pop 320ms ease-out" }}
                    aria-hidden
                  />
                )}
              </span>
              {step}
            </li>
          );
        })}
      </ul>

      <MockButton label={TASK_CTA} />
    </MockCard>
  );
}

/** Version 4's outcome card, where the post slides in on scroll. */
export function UpdateSlideCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);

  return (
    <MockCard title={UPDATE_TITLE_SHORT} cardRef={ref} className="pb-0">
      <div
        className={cn(
          "relative flex-1 overflow-hidden bg-[var(--rd-ink)]/[0.05] px-3.5 pt-3",
          inView ? "rd-post-slide-in" : "opacity-0",
        )}
      >
        <div className="flex items-center gap-2">
          <img
            src={testimonials[0].avatar}
            alt=""
            aria-hidden
            className="size-5 rounded object-cover"
          />
          <span className="text-[0.82rem] font-medium text-[var(--rd-ink)]">
            {UPDATE_AUTHOR}
          </span>
        </div>
        <p className="mt-2.5 text-[0.82rem] font-semibold text-[var(--rd-ink)]">
          {UPDATE_HEADLINE}
        </p>
        <p className="mt-2 text-[0.82rem] leading-snug text-[var(--rd-ink)]/75">
          {UPDATE_BODY}
        </p>
      </div>
    </MockCard>
  );
}
