import { KORA_REVIEW_PATH, KoraProjectStatus } from "@alliance/common/kora";
import { cn } from "@alliance/shared/styles/util";
import { Check, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { Link } from "react-router";
import { DisplayHeading, SiteSubtitle, SubtitleSize } from "../../../site/ui";
import { CLOSED_HEADING } from "./copy";
import { KoraClosedNotice } from "./KoraClosedNotice";
import { RISK_CATEGORIES, RiskCategory } from "./riskCategories";

export const REMIND_ME_KEY = "kora.remindMe";

export enum KoraViewer {
  Participant = "participant",
  Member = "member",
}

const HEADING: Record<KoraViewer, string> = {
  [KoraViewer.Participant]: "Thank you for joining the waitlist",
  [KoraViewer.Member]:
    "Alliance members will help shape how children interact with AI chatbots",
};

const REMIND_ME_NOTE: Record<KoraViewer, string> = {
  [KoraViewer.Participant]:
    "We’ll notify you when the reviews are ready for your input.",
  [KoraViewer.Member]:
    "Alliance members will be notified when the reviews launch.",
};

const REMIND_ME_LOCKED: Record<KoraViewer, boolean> = {
  [KoraViewer.Participant]: false,
  [KoraViewer.Member]: true,
};
export const ROTATE_MS = 5000;

const CATEGORIES = Object.values(RiskCategory);

function CategoryDot({ category }: { category: RiskCategory }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{
        backgroundColor: `hsl(${RISK_CATEGORIES[category].hue} 60% 45%)`,
      }}
    />
  );
}

function CategoryBlurb({ category }: { category: RiskCategory }) {
  const info = RISK_CATEGORIES[category];
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="flex items-center gap-2 text-xl font-medium sm:text-2xl">
        <CategoryDot category={category} />
        {info.label}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <p className="flex gap-3 rounded-lg bg-green-50 p-4 text-zinc-800">
          <Check
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-green-700"
          />
          <span>
            <span className="block text-sm font-medium text-green-800">
              A responsible chatbot will
            </span>
            {info.goodBehavior}.
          </span>
        </p>
        <p className="flex gap-3 rounded-lg bg-red-50 p-4 text-zinc-800">
          <X aria-hidden className="mt-0.5 size-5 shrink-0 text-red-700" />
          <span>
            <span className="block text-sm font-medium text-red-800">
              A failing chatbot will
            </span>
            {info.badBehavior}.
          </span>
        </p>
      </div>
    </div>
  );
}

const COUNT = CATEGORIES.length;
const TRACK = [0, 1, 2].flatMap((copy) =>
  CATEGORIES.map((category, i) => ({ category, copy, pos: copy * COUNT + i })),
);

function CategoryCycle() {
  const [pos, setPos] = useState(COUNT);
  const [rotating, setRotating] = useState(true);
  const [animate, setAnimate] = useState(false);
  const [offset, setOffset] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const pills = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRotating(false);
    }
  }, []);
  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => setPos((p) => p + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [rotating]);
  useLayoutEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const center = () => {
      const pill = pills.current[pos];
      if (pill) {
        setOffset(
          view.clientWidth / 2 - (pill.offsetLeft + pill.offsetWidth / 2),
        );
      }
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(view);
    if (view.firstElementChild) observer.observe(view.firstElementChild);
    return () => observer.disconnect();
  }, [pos]);
  useEffect(() => {
    if (animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);
  useEffect(() => {
    if (!animate && (pos < COUNT || pos >= 2 * COUNT)) {
      setPos(COUNT + (pos % COUNT));
    }
  }, [animate, pos]);

  // The track renders the list three times so it can keep sliding left; once
  // it settles outside the middle copy, it jumps without animation to the
  // identical pill in the middle.
  const recenter = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (pos >= COUNT && pos < 2 * COUNT) return;
    setAnimate(false);
  };

  const choose = (target: number) => {
    if (target % COUNT === pos % COUNT) {
      setRotating(!rotating);
      return;
    }
    setPos(target);
    setRotating(false);
  };
  // A mouse click focuses the chip in some browsers; only keyboard focus
  // moves the track, so the click still toggles rotation.
  const focus = (target: number, chip: HTMLButtonElement) => {
    if (!chip.matches(":focus-visible")) return;
    if (target % COUNT !== pos % COUNT) setPos(target);
    setRotating(false);
  };

  const active = CATEGORIES[pos % COUNT];
  return (
    <section
      aria-label="What reviewers look for"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4"
    >
      <div
        ref={viewport}
        className="overflow-clip py-1 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      >
        <div
          role="group"
          aria-label="Choose a category"
          onTransitionEnd={recenter}
          className={cn(
            "flex w-max gap-2",
            animate && "transition-transform duration-500 ease-out",
          )}
          style={{ transform: `translateX(${offset}px)` }}
        >
          {TRACK.map(({ category, copy, pos: target }) => {
            const current = target === pos;
            const duplicate = copy !== 1;
            return (
              <button
                key={target}
                ref={(el) => {
                  pills.current[target] = el;
                }}
                type="button"
                aria-hidden={duplicate || undefined}
                tabIndex={duplicate ? -1 : undefined}
                aria-current={(!duplicate && category === active) || undefined}
                title={current ? (rotating ? "Pause" : "Play") : undefined}
                onClick={() => choose(target)}
                onFocus={(event) => focus(target, event.currentTarget)}
                className={cn(
                  "site-sans inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                  !current &&
                    "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
                  current && rotating && "border-zinc-300 bg-zinc-100",
                  current && !rotating && "border-zinc-400 bg-zinc-300",
                )}
              >
                <CategoryDot category={category} />
                {RISK_CATEGORIES[category].label}
              </button>
            );
          })}
        </div>
      </div>
      <div aria-live={rotating ? "off" : "polite"}>
        <CategoryBlurb category={active} />
      </div>
    </section>
  );
}

function RemindMeToggle({ viewer }: { viewer: KoraViewer }) {
  const locked = REMIND_ME_LOCKED[viewer];
  const [stored, setOn] = useState(true);
  const on = locked || stored;
  useEffect(() => {
    if (localStorage.getItem(REMIND_ME_KEY) === "false") setOn(false);
  }, []);
  const toggle = () => {
    localStorage.setItem(REMIND_ME_KEY, String(!on));
    setOn(!on);
  };
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="kora-remind-me"
        aria-describedby="kora-remind-me-note"
        onClick={toggle}
        disabled={locked}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed",
          on ? "bg-green" : "bg-zinc-300",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
            on && "translate-x-5",
          )}
        />
      </button>
      <div className="flex flex-col">
        <span id="kora-remind-me" className="font-medium">
          Remind me
        </span>
        <span id="kora-remind-me-note" className="text-sm text-zinc-500">
          {REMIND_ME_NOTE[viewer]}
        </span>
      </div>
    </div>
  );
}

export function KoraWelcome({
  viewer,
  account,
  status,
}: {
  viewer: KoraViewer;
  account: ReactNode;
  status: KoraProjectStatus;
}) {
  const closed = status === KoraProjectStatus.Closed;
  return (
    <div className="flex flex-col gap-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <DisplayHeading as="h1" className="text-5xl sm:text-6xl lg:text-7xl">
          {closed ? CLOSED_HEADING : HEADING[viewer]}
        </DisplayHeading>
        <SiteSubtitle size={SubtitleSize.Page} className="max-w-none">
          Our partner,{" "}
          <a
            href="https://korabench.ai/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            KoraBench
          </a>
          , needs human reviewers to review scenarios and chatbot transcripts
          and provide insight about which chat services are failing to provide
          our children with proper guidance
        </SiteSubtitle>
      </div>
      <CategoryCycle />
      {closed ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <KoraClosedNotice />
          {account}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
          {status === KoraProjectStatus.Active ? (
            <div className="flex w-fit max-w-xs shrink-0 flex-col gap-4 bg-yellow-200 px-6 py-8 text-zinc-900 shadow-md">
              <p className="text-lg font-medium">Reviews are open.</p>
              <Link
                to={KORA_REVIEW_PATH}
                className="site-sans inline-flex min-h-11 items-center self-start rounded-lg bg-black px-5 font-medium text-white"
              >
                Start reviewing
              </Link>
            </div>
          ) : (
            <p
              role="note"
              className="w-fit max-w-xs shrink-0 -rotate-2 bg-yellow-200 px-6 py-12 text-lg font-medium text-zinc-900 shadow-md"
            >
              Reviews start on November 17th.
            </p>
          )}
          <div className="flex flex-col gap-6">
            <RemindMeToggle viewer={viewer} />
            {account}
          </div>
        </div>
      )}
    </div>
  );
}
