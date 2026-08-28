import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import {
  COMMIT_PLEDGE,
  COMMIT_SIGNATURE,
  COMMIT_SIGNATURE_LABEL,
  COMMIT_TITLE,
  TASK_CTA,
  TASK_PROGRESS_DONE,
  TASK_PROGRESS_TOTAL,
  TASK_STEPS,
  TASK_TITLE,
  UPDATE_BODY,
  UPDATE_HEADLINE,
  UPDATE_TITLE,
} from "../content";
import { FALLBACK_FACE, useUpdateAuthor } from "../data";
import { useInView, usePrefersReducedMotion } from "../hooks";

const CARD_H = "min-h-[236px]";

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
        "flex flex-col overflow-hidden bg-zinc-50 px-5 pt-8",
        CARD_H,
        className,
      )}
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <p className="mb-12 text-2xl font-medium text-[var(--site-ink)]">
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
        backgroundColor: "var(--site-primary)",
        borderRadius: "var(--site-radius-button)",
      }}
    >
      {label}
    </div>
  );
}

function useTypewriter(text: string, active: boolean, msPerChar: number) {
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

/**
 * The pledge is stated for the member and they only sign it, which reads less
 * like an exam than typing the sentence out.
 */
export function CommitCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const { typed, done } = useTypewriter(COMMIT_SIGNATURE, inView, 150);

  return (
    <MockCard title={COMMIT_TITLE} cardRef={ref}>
      <p className="border-l-2 border-[var(--site-primary)] bg-[var(--site-ink)]/[0.06] px-3 py-3 text-[0.88rem] leading-snug text-[var(--site-ink)]/80">
        {COMMIT_PLEDGE}
      </p>
      <p className="mt-4 text-[0.72rem] tracking-wide text-[var(--site-ink)]/45 uppercase">
        {COMMIT_SIGNATURE_LABEL}
      </p>
      {/*
       * The row owns the remaining height and the glyphs sit on its baseline, so
       * ascenders and descenders appearing mid-word can't shift the layout.
       */}
      <div className="mt-auto mb-5 flex flex-1 items-end border-b border-[var(--site-ink)]/25">
        <span className="site-signature flex h-[2.9rem] items-end pb-1 text-[2.9rem] leading-none whitespace-nowrap text-[var(--site-ink)]">
          {typed}
          {!done && (
            <span
              className="mb-[0.45rem] ml-0.5 inline-block h-[1.4rem] w-px shrink-0 bg-[var(--site-ink)]"
              style={{ animation: "site-caret 1s steps(1) infinite" }}
              aria-hidden
            />
          )}
        </span>
      </div>
    </MockCard>
  );
}

/** The action as a member receives it: two steps, and how many have finished. */
export function TaskCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const reduced = usePrefersReducedMotion();
  const [checked, setChecked] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setChecked(TASK_STEPS.length);
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
        <div className="h-2 overflow-hidden rounded-full bg-[var(--site-ink)]/12">
          <div
            className="h-full origin-left rounded-full bg-[var(--site-primary)] transition-transform duration-[900ms] ease-out"
            style={{ transform: `scaleX(${inView ? percent / 100 : 0})` }}
          />
        </div>
        <p className="text-[0.78rem] text-[var(--site-ink)]/60">
          {TASK_PROGRESS_DONE}/{TASK_PROGRESS_TOTAL} members have completed the
          week&apos;s tasks
        </p>
      </div>

      <ul className="my-3.5 flex flex-col gap-1">
        {TASK_STEPS.map((step, i) => {
          const isChecked = i < checked;
          return (
            <li
              key={step}
              className="flex items-center gap-2.5 rounded bg-[var(--site-ink)]/[0.06] px-2 py-1.5 text-[0.82rem] font-medium text-[var(--site-ink)]"
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isChecked
                    ? "border-[var(--site-primary)] bg-[var(--site-primary)] text-white"
                    : "border-[var(--site-primary)]/70",
                )}
              >
                {isChecked && (
                  <Check
                    className="size-2.5"
                    strokeWidth={3.5}
                    style={{ animation: "site-check-pop 320ms ease-out" }}
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

/** The outcome card, where the published post slides in on scroll. */
export function UpdateCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const author = useUpdateAuthor();

  return (
    <MockCard title={UPDATE_TITLE} cardRef={ref} className="pb-0">
      <div
        className={cn(
          "relative flex-1 overflow-hidden bg-[var(--site-ink)]/[0.05] px-3.5 pt-3",
          inView ? "site-post-slide-in" : "opacity-0",
        )}
      >
        <div className="flex items-center gap-2">
          <img
            src={author?.avatar ?? FALLBACK_FACE}
            alt=""
            aria-hidden
            className="size-5 rounded object-cover"
          />
          <span className="text-[0.82rem] font-medium text-[var(--site-ink)]">
            {author?.name ?? "The office"}
          </span>
        </div>
        <p className="mt-2.5 text-[0.82rem] font-semibold text-[var(--site-ink)]">
          {UPDATE_HEADLINE}
        </p>
        <p className="mt-2 text-[0.82rem] leading-snug text-[var(--site-ink)]/75">
          {UPDATE_BODY}
        </p>
      </div>
    </MockCard>
  );
}
