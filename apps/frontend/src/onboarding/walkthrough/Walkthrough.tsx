import { cn } from "@alliance/shared/styles/util";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import "../onboarding.css";
import {
  FIRST_TASK_ANCHOR,
  TOUR_INTRO_PARAM,
  WALKTHROUGH_PARAM,
  WALKTHROUGH_PATH,
} from "./steps";
import { WalkthroughIntro } from "./WalkthroughIntro";

/** How long the tour waits for the task before ending unseen. */
const ANCHOR_TIMEOUT_MS = 10_000;

/** Frames the task may go missing for mid-render before the tour ends. */
const MISSES_BEFORE_DROP = 12;

const PADDING = 8;

/** Clear space kept between the task and the edges it is scrolled between. */
const SAFE_GAP = 16;

/** Enough to settle a smooth scroll, without letting a fight run forever. */
const MAX_SCROLLS = 6;

const SCROLL_SETTLE_MS = 420;

type Box = { top: number; left: number; width: number; height: number };

function sameBox(a: Box | null, b: Box) {
  return (
    a !== null &&
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

const TASK_SELECTOR = `[data-walkthrough="${FIRST_TASK_ANCHOR}"]`;

function Spotlight({ box, onDismiss }: { box: Box; onDismiss: () => void }) {
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
        onClick={onDismiss}
      />
      <div
        className={shade}
        style={{ top: bottom, left: 0, right: 0, bottom: 0 }}
        onClick={onDismiss}
      />
      <div
        className={shade}
        style={{ top, left: 0, width: left, height: bottom - top }}
        onClick={onDismiss}
      />
      <div
        className={shade}
        style={{ top, left: right, right: 0, height: bottom - top }}
        onClick={onDismiss}
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
 * and the dialogue. A task taller than the band gets its foot, where Begin is,
 * pinned to the band's bottom instead.
 */
export function scrollDelta(
  box: Box,
  safeBottom: number,
  headerBottom: number,
): number {
  const top = headerBottom + SAFE_GAP;
  const bottom = safeBottom - SAFE_GAP;
  if (box.height > bottom - top || box.top + box.height > bottom) {
    return box.top + box.height - bottom;
  }
  if (box.top < top) return box.top - top;
  return 0;
}

export function Walkthrough() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const open =
    searchParams.has(WALKTHROUGH_PARAM) &&
    location.pathname === WALKTHROUGH_PATH;
  const intro = searchParams.has(TOUR_INTRO_PARAM);

  const endIntro = useCallback(() => {
    setSearchParams(
      (params) => {
        params.delete(TOUR_INTRO_PARAM);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [setSearchParams]);

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

  if (!open) return null;
  return <OpenWalkthrough intro={intro} close={close} endIntro={endIntro} />;
}

function OpenWalkthrough({
  intro,
  close,
  endIntro,
}: {
  intro: boolean;
  close: () => void;
  endIntro: () => void;
}) {
  const [measured, setMeasured] = useState<Box | null>(null);
  const [seen, setSeen] = useState(false);
  const [dialogue, setDialogue] = useState<HTMLDivElement | null>(null);
  const [dialogueBox, setDialogueBox] = useState<Box | null>(null);

  // Captured: the task's own handlers may stop propagation.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(TASK_SELECTOR)
      ) {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick, true);
    };
  }, [close]);

  useLayoutEffect(() => {
    if (!dialogue) return;
    const r = dialogue.getBoundingClientRect();
    setDialogueBox({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [dialogue]);

  // The dialogue stays hidden until the task turns up, and the tour ends once
  // it is gone, so it never introduces a task that isn't there.
  useEffect(() => {
    let frame = 0;
    let shown = false;
    let misses = 0;
    let scrolls = 0;
    let lastScroll = 0;
    const deadline = Date.now() + ANCHOR_TIMEOUT_MS;

    // Measured once and on resize, never per frame: the scan walks every
    // element in the page, and the bar it finds does not move while the tour
    // is on screen.
    let headerBottom = pinnedHeaderBottom();
    const remeasureHeader = () => {
      headerBottom = pinnedHeaderBottom();
    };
    window.addEventListener("resize", remeasureHeader);

    const tick = () => {
      const el = document.querySelector<HTMLElement>(TASK_SELECTOR);
      const r = el?.getBoundingClientRect();
      if (el && r && r.height > 0) {
        if (!shown) setSeen(true);
        shown = true;
        misses = 0;

        // The dialogue covers the foot of the screen, so the task is scrolled
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
          const box: Box = {
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          };
          return sameBox(previous, box) ? previous : box;
        });
      } else if (shown) {
        if (++misses > MISSES_BEFORE_DROP) {
          close();
          return;
        }
      } else if (Date.now() > deadline) {
        close();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", remeasureHeader);
    };
  }, [dialogueBox, close]);

  return (
    <div
      data-ob-tour
      className={cn("pointer-events-none fixed inset-0", zIndex.modal)}
    >
      <div
        className={cn("transition-opacity duration-300", intro && "opacity-0")}
      >
        {seen && measured && <Spotlight box={measured} onDismiss={close} />}

        <div
          ref={setDialogue}
          role="status"
          className={cn(
            "pointer-events-auto fixed bottom-4 left-1/2 z-10 w-[min(30rem,calc(100vw-1.5rem))]",
            "-translate-x-1/2 rounded-xl bg-[var(--ob-navy)] p-4 text-white sm:bottom-8 sm:p-5",
            "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]",
            !seen && "invisible",
          )}
        >
          <p className="text-[length:var(--ob-body)] font-semibold">
            Your first task
          </p>
          <p className="mt-1 text-[length:var(--ob-ui)] leading-snug text-pretty text-white/85">
            Welcome to the Alliance! Start with this task.
          </p>
        </div>
      </div>

      {intro && <WalkthroughIntro onDone={endIntro} />}
    </div>
  );
}
