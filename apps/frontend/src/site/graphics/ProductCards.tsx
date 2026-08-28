import { cn } from "@alliance/shared/styles/util";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import {
  COMMIT_PLEDGE,
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

const CARD_ICON = "size-6";
const MOCK_COPY = "text-lg leading-snug";
const MOCK_COPY_SMALL = "text-base leading-snug";

/** Two slightly bowed strokes so the commit mark reads as drawn, not geometric. */
function HanddrawnX({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className ?? CARD_ICON}
      aria-hidden
    >
      <path
        d="M5.2 4.9c4.4 3.2 8.8 8.9 13.7 14.4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M18.7 5.1c-2.4 3.5-8.1 9.5-13.8 14"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MockCard({
  title,
  icon,
  children,
  cardRef,
  className,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  cardRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div
      ref={cardRef}
      className={cn(
        "flex h-full w-full flex-col gap-6 overflow-visible bg-zinc-100 p-6",
        className,
      )}
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-2xl font-medium text-black sm:text-3xl">{title}</p>
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-md  text-black"
          aria-hidden
        >
          {icon}
        </span>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function MockInnerCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden bg-white p-4 sm:p-5 shadow-[0_15px_22px_0px_rgba(0,0,0,0.04)]",
        className,
      )}
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      {children}
    </div>
  );
}

function MockButton({ label }: { label: string }) {
  return (
    <div
      className={cn(MOCK_COPY, "py-2.5 text-center font-medium text-white")}
      style={{
        backgroundColor: "black",
        borderRadius: "var(--site-radius-button)",
      }}
    >
      {label}
    </div>
  );
}

function CommitCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-sm border border-2",
        checked ? "border-(--site-ink) text-(--site-ink)" : "border-zinc-300",
      )}
      aria-hidden
    >
      {checked && <HanddrawnX className="size-5" />}
    </span>
  );
}

/** One checked line, then unread rows so the card reads as a longer form. */
export function CommitCard() {
  return (
    <MockCard title={COMMIT_TITLE} icon={<HanddrawnX />}>
      <MockInnerCard>
        <ul className="flex flex-col gap-2.5">
          <li
            className={cn(
              MOCK_COPY,
              "flex items-center gap-2.5 font-medium text-[var(--site-ink)]",
            )}
          >
            <CommitCheckbox checked />
            {COMMIT_PLEDGE}
          </li>
          <li className="flex items-center gap-2.5">
            <CommitCheckbox checked={false} />
            <span className="min-w-0 flex-1" aria-hidden>
              <span className="block h-3.5 w-[92%] rounded-sm bg-zinc-100" />
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <CommitCheckbox checked={false} />
            <span className="min-w-0 flex-1" aria-hidden>
              <span className="block h-3.5 w-[68%] rounded-sm bg-zinc-100" />
            </span>
          </li>
        </ul>
      </MockInnerCard>
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
    <MockCard
      title={TASK_TITLE}
      icon={<Check className={CARD_ICON} strokeWidth={2.5} />}
      cardRef={ref}
    >
      <MockInnerCard>
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full origin-left rounded-full bg-green transition-transform duration-[900ms] ease-out"
              style={{ transform: `scaleX(${inView ? percent / 100 : 0})` }}
            />
          </div>
          <p className={cn(MOCK_COPY_SMALL, "text-zinc-500")}>
            {TASK_PROGRESS_DONE}/{TASK_PROGRESS_TOTAL} members have completed
            the week&apos;s tasks
          </p>
        </div>

        <ul className="my-3.5 flex flex-col gap-1">
          {TASK_STEPS.map((step, i) => {
            const isChecked = i < checked;
            return (
              <li
                key={step}
                className={cn(
                  MOCK_COPY,
                  "flex items-center gap-2.5 bg-zinc-100 p-2 rounded-md font-medium text-(--site-ink)",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    isChecked
                      ? "bg-green text-white border-none"
                      : "border border-2 border-green",
                  )}
                >
                  {isChecked && (
                    <Check
                      className="size-3"
                      strokeWidth={6}
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
      </MockInnerCard>
    </MockCard>
  );
}

/** The outcome card, where the published post slides in on scroll. */
export function UpdateCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const author = useUpdateAuthor();

  return (
    <MockCard
      title={UPDATE_TITLE}
      icon={<ArrowRight className={CARD_ICON} strokeWidth={2.5} />}
      cardRef={ref}
    >
      <MockInnerCard className={inView ? "site-post-slide-in" : "opacity-0"}>
        <div className="flex items-center gap-2">
          <img
            src={author?.avatar ?? FALLBACK_FACE}
            alt=""
            aria-hidden
            className="size-6 rounded object-cover"
          />
          <span className={cn(MOCK_COPY_SMALL, " text-[var(--site-ink)]")}>
            {author?.name ?? "The office"}
          </span>
        </div>
        <p
          className={cn(MOCK_COPY, "mt-2.5 font-medium text-[var(--site-ink)]")}
        >
          {UPDATE_HEADLINE}
        </p>
        <p className={cn(MOCK_COPY, "mt-2 text-[var(--site-ink)]/75")}>
          {UPDATE_BODY}
        </p>
      </MockInnerCard>
    </MockCard>
  );
}
