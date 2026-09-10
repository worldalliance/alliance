import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import "../onboarding.css";
import { MOCK_PARAM } from "../useMockTasks";
import {
  TOUR_INTRO_PARAM,
  WALKTHROUGH_PARAM,
  WALKTHROUGH_STEPS,
  walkthroughStepHref,
  type WalkthroughAnchor,
} from "./steps";
import { WalkthroughIntro } from "./WalkthroughIntro";

/** How long a step waits for its anchor before settling for no spotlight. */
const ANCHOR_TIMEOUT_MS = 1800;

/** Frames an anchor may go missing for mid-render before the spotlight drops. */
const MISSES_BEFORE_DROP = 12;

const PADDING = 8;

/** Clear space kept between an anchor and the edges it is scrolled between. */
const SAFE_GAP = 16;

/** Enough to settle a smooth scroll, without letting a fight run forever. */
const MAX_SCROLLS = 6;

const SCROLL_SETTLE_MS = 420;

const TOUR_BUTTON = "min-h-11 w-full rounded-lg";

const TOUR_PRIMARY = "border-transparent bg-white text-(--ob-green)";

const TOUR_SECONDARY =
  "border-white/70 bg-transparent text-white hover:bg-white/10";

type Box = { top: number; left: number; width: number; height: number };

/** Tagged with its anchor so a frame left over from the last step can't show. */
type Measurement = Box & { anchor: WalkthroughAnchor };

// Absolute children (the profile menu) sit outside the anchor's own box.
function visibleBox(el: HTMLElement): Box {
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const add = (node: Element) => {
    const r = node.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  };
  add(el);
  for (const child of el.children) add(child);
  return { top, left, width: right - left, height: bottom - top };
}

function sameBox(a: Measurement | null, b: Measurement) {
  return (
    a !== null &&
    a.anchor === b.anchor &&
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

function Spotlight({ box }: { box: Box }) {
  const shade = "pointer-events-auto fixed bg-black/60";
  // Clamped to the viewport: an anchor taller than the screen would otherwise
  // make shades thousands of pixels long, which the compositor mishandles.
  const top = Math.max(box.top - PADDING, 0);
  const bottom = Math.min(box.top + box.height + PADDING, window.innerHeight);
  const left = Math.max(box.left - PADDING, 0);
  const right = Math.min(box.left + box.width + PADDING, window.innerWidth);

  return (
    <>
      <div
        className={shade}
        style={{ top: 0, left: 0, right: 0, height: top }}
      />
      <div
        className={shade}
        style={{ top: bottom, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className={shade}
        style={{ top, left: 0, width: left, height: bottom - top }}
      />
      <div
        className={shade}
        style={{ top, left: right, right: 0, height: bottom - top }}
      />
      <div
        className="pointer-events-none fixed rounded-lg ring-2 ring-white/80"
        style={{ top, left, width: right - left, height: bottom - top }}
      />
    </>
  );
}

/** The nearest ancestor that actually scrolls, which on a phone is not the page. */
function scrollParent(el: Element): Element | Window {
  let parent = el.parentElement;
  while (parent) {
    const overflow = getComputedStyle(parent).overflowY;
    if (
      /auto|scroll/.test(overflow) &&
      parent.scrollHeight > parent.clientHeight + 1
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

/**
 * The lowest edge of anything pinned across the top of the viewport. Scrolling
 * an anchor to a flat offset puts its head under the app bar, which reads as
 * the spotlight being cut off.
 */
function pinnedHeaderBottom(): number {
  let bottom = 0;
  for (const node of document.querySelectorAll<HTMLElement>("body *")) {
    if (node.closest("[data-ob-tour]")) continue;
    const style = getComputedStyle(node);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    const box = node.getBoundingClientRect();
    const spansTop = box.top <= 0 && box.width > window.innerWidth * 0.5;
    if (spansTop && box.height > 0 && box.height < window.innerHeight / 3) {
      bottom = Math.max(bottom, box.bottom);
    }
  }
  return bottom;
}

/**
 * How far to scroll to bring `box` inside the band between the pinned header
 * and the dialogue. An anchor taller than the band gets its head pinned to the
 * band's top instead.
 */
function scrollDelta(
  box: Box,
  safeBottom: number,
  headerBottom: number,
): number {
  const top = headerBottom + SAFE_GAP;
  const bottom = safeBottom - SAFE_GAP;
  if (box.height > bottom - top || box.top < top) return box.top - top;
  if (box.top + box.height > bottom) return box.top + box.height - bottom;
  return 0;
}

export function Walkthrough() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const raw = searchParams.get(WALKTHROUGH_PARAM);
  const index = raw === null ? -1 : Number(raw);
  const step = WALKTHROUGH_STEPS[index];

  const anchor = step?.anchor;

  const [measured, setMeasured] = useState<Measurement | null>(null);
  const [dialogue, setDialogue] = useState<HTMLDivElement | null>(null);
  const [dialogueBox, setDialogueBox] = useState<Box | null>(null);

  const intro = searchParams.get(TOUR_INTRO_PARAM) !== null;

  const endIntro = useCallback(() => {
    setSearchParams(
      (params) => {
        params.delete(TOUR_INTRO_PARAM);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [setSearchParams]);

  const mocked = searchParams.get(MOCK_PARAM) === "1";
  const stepHref = useCallback(
    (at: number) => walkthroughStepHref(at, mocked),
    [mocked],
  );

  const close = useCallback(() => {
    setSearchParams(
      (params) => {
        params.delete(WALKTHROUGH_PARAM);
        params.delete(TOUR_INTRO_PARAM);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [setSearchParams]);

  const advance = useCallback(() => {
    const next = index + 1;
    if (next >= WALKTHROUGH_STEPS.length) {
      close();
      return;
    }
    navigate(stepHref(next), { replace: true, preventScrollReset: true });
  }, [index, close, navigate, stepHref]);

  const onStepPath = Boolean(step) && location.pathname === step.path;

  useEffect(() => {
    if (!step || onStepPath) return;
    const next = index + 1;
    const followed =
      next < WALKTHROUGH_STEPS.length &&
      location.pathname === WALKTHROUGH_STEPS[next].path;
    navigate(stepHref(followed ? next : index), {
      replace: true,
      preventScrollReset: true,
    });
  }, [step, onStepPath, navigate, index, stepHref, location.pathname]);

  useLayoutEffect(() => {
    if (!dialogue) return;
    const r = dialogue.getBoundingClientRect();
    setDialogueBox({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [dialogue, index]);

  // A step whose anchor never turns up still gets its say; it just loses the
  // spotlight rather than skipping and jumping the count.
  useEffect(() => {
    if (!step || !onStepPath || !anchor) return;

    let frame = 0;
    let found = false;
    let misses = 0;
    let scrolls = 0;
    let lastScroll = 0;
    const deadline = Date.now() + ANCHOR_TIMEOUT_MS;

    // Measured per step and on resize, never per frame: the scan walks every
    // element in the page, and the bar it finds does not move while a step is
    // on screen.
    let headerBottom = pinnedHeaderBottom();
    const remeasureHeader = () => {
      headerBottom = pinnedHeaderBottom();
    };
    window.addEventListener("resize", remeasureHeader);

    const tick = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-walkthrough="${anchor}"]`,
      );
      const r = el ? visibleBox(el) : null;
      if (el && r && r.height > 0) {
        found = true;
        misses = 0;

        // The dialogue covers the foot of the screen, so the anchor is scrolled
        // into what is left above it rather than to the viewport's own middle.
        const safeBottom = dialogueBox?.top ?? window.innerHeight;
        const delta = scrollDelta(r, safeBottom, headerBottom);
        if (
          Math.abs(delta) > 8 &&
          scrolls < MAX_SCROLLS &&
          Date.now() - lastScroll > SCROLL_SETTLE_MS
        ) {
          scrollParent(el).scrollBy({ top: delta, behavior: "smooth" });
          scrolls += 1;
          lastScroll = Date.now();
        }

        setMeasured((previous) => {
          const box: Measurement = {
            anchor,
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          };
          return sameBox(previous, box) ? previous : box;
        });
      } else if (
        found ? ++misses > MISSES_BEFORE_DROP : Date.now() > deadline
      ) {
        setMeasured(null);
        found = false;
      }
      frame = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", remeasureHeader);
    };
  }, [step, onStepPath, anchor, dialogueBox]);

  useEffect(() => setMeasured(null), [index]);

  if (!step || !onStepPath) return null;

  const spotlight = measured?.anchor === anchor ? measured : null;
  const isLast = index + 1 === WALKTHROUGH_STEPS.length;

  return (
    <div
      data-ob-tour
      className={cn("pointer-events-none fixed inset-0", zIndex.modal)}
    >
      <div
        className={cn("transition-opacity duration-300", intro && "opacity-0")}
      >
        {spotlight ? (
          <Spotlight box={spotlight} />
        ) : (
          <div className="pointer-events-auto fixed inset-0 bg-black/60" />
        )}

        <div
          ref={setDialogue}
          role="dialog"
          aria-live="polite"
          className={cn(
            "pointer-events-auto fixed bottom-4 left-1/2 z-10 w-[min(30rem,calc(100vw-1.5rem))]",
            "-translate-x-1/2 rounded-xl bg-[var(--ob-green)] p-4 text-white sm:bottom-8 sm:p-5",
            "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-[length:var(--ob-body)] font-semibold">
              {step.title()}
            </p>
            <span className="shrink-0 text-[length:var(--ob-caption)] text-white/60 tabular-nums">
              {index + 1} of {WALKTHROUGH_STEPS.length}
            </span>
          </div>
          <p className="mt-1 text-[length:var(--ob-ui)] leading-snug text-pretty text-white/85">
            {step.body()}
          </p>
          <div className="mt-3 sm:mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                color={ButtonColor.Outline}
                className={cn(TOUR_BUTTON, TOUR_SECONDARY)}
                onClick={close}
              >
                Skip
              </Button>
              <Button
                color={ButtonColor.WhiteBorderless}
                className={cn(TOUR_BUTTON, TOUR_PRIMARY)}
                onClick={advance}
              >
                {isLast ? "Get started" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {intro && <WalkthroughIntro onDone={endIntro} />}
    </div>
  );
}
