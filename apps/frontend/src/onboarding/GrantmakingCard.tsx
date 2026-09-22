import { cn } from "@alliance/shared/styles/util";
import { Clock } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import grassField from "../assets/redesign/grass-field.jpg";
import {
  GrantmakingMemberProgress,
  ProgressTone,
} from "../components/projects/democratic-grantmaking-26/GrantmakingMemberProgress";

const TASK_TITLE = "Compare candidates for our $100,000 grant";

const TASK_MINUTES = 15;

const CARD_HEADLINE = "Join the Alliance to unlock $100,000 for the world";

const CARD_STANDFIRST =
  "Philanthropists are committing funds toward a shared pool. At 1,000 members, we\u2019ll vote together on where it goes.";

const TASK_BODY = [
  "We’re organizing a pilot of a democratic grantmaking process in which grants are made by combining expert beliefs and participant values. More specifically, we will elicit participant preferences over the expected result of various grants, as assessed by expert judgement.",
  "We aim to pilot an initial round of this process with >$100,000 committed and >1,000 participants. Pitches must relate to one of our four priorities: dangerous technologies, global poverty, democratic decline, and environmental destruction.",
];

/** A task from the grantmaking project, drawn the way the real task list draws one. */
function GrantTaskMock() {
  return (
    <div className="w-full max-w-[31.2rem] rounded-xl bg-white p-5 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.55)]">
      <p className="text-[1.0625rem] leading-snug font-semibold text-balance text-black">
        {TASK_TITLE}
      </p>

      <GrantmakingMemberProgress
        className="mt-2 gap-2 text-sm"
        tone={ProgressTone.OnCard}
        caption={false}
      />

      <div className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-[var(--color-green)]">
        <Clock className="size-3.5" aria-hidden />
        {TASK_MINUTES} minutes
      </div>

      {/* Three lines and then it feathers out, the way the real task body does. */}
      <div
        className="mt-3 max-h-[4.35rem] overflow-hidden text-[0.8125rem] leading-[1.45] text-zinc-700"
        style={{
          maskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, #000 45%, transparent 100%)",
        }}
      >
        {TASK_BODY.map((paragraph) => (
          <p key={paragraph} className="mt-2 first:mt-0">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Drops the card's copy a line at a time, standfirst first, as the card runs
 * short of the height to show it. Every pass starts from the full copy, so a
 * window that grows back brings the lines back with it.
 */
function useCopyFit() {
  const card = useRef<HTMLDivElement>(null);
  const headline = useRef<HTMLParagraphElement>(null);
  const standfirst = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const box = card.current;
    const headlineEl = headline.current;
    const standfirstEl = standfirst.current;
    if (!box || !headlineEl || !standfirstEl) return;

    const overflows = () => box.scrollHeight > box.clientHeight;

    const measure = () => {
      headlineEl.style.removeProperty("display");
      standfirstEl.style.removeProperty("display");
      if (!overflows()) return;
      standfirstEl.style.display = "none";
      if (!overflows()) return;
      headlineEl.style.display = "none";
    };

    measure();

    // The observer watches the card's own box, which a webfont swap does not
    // resize. Without this the decision stands on the fallback's metrics.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });

    if (typeof ResizeObserver === "undefined") {
      return () => {
        live = false;
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, []);

  return { card, headline, standfirst };
}

export function GrantmakingCard({ className }: { className?: string }) {
  const fit = useCopyFit();

  return (
    <div
      ref={fit.card}
      className={cn(
        "relative isolate flex flex-col justify-between overflow-hidden p-7 text-left sm:p-9",
        className,
      )}
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <img
        src={grassField}
        alt=""
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      {/* The type sits straight on the photo, so it needs its own floor of contrast. */}
      <div
        className="absolute inset-0 -z-10 bg-[var(--site-primary)]/58"
        aria-hidden
      />

      <div className="flex flex-1 items-center justify-center py-6">
        <GrantTaskMock />
      </div>

      <div className="max-w-[33rem]">
        <p
          ref={fit.headline}
          className="text-xl leading-[1.35] text-white sm:text-2xl"
        >
          {CARD_HEADLINE}
        </p>
        <p
          ref={fit.standfirst}
          className="mt-1.5 text-base text-white/70 md:text-lg"
        >
          {CARD_STANDFIRST}
        </p>
      </div>
    </div>
  );
}
