import { useEffect, useState } from "react";

/** Clearance left between the card's rule and the title that rises toward it. */
const RULE_GAP = 12;

/**
 * What a card has to be for its description to open without pushing the title
 * into the rule across its head. The description is clipped rather than absent
 * while closed, so the height it will take is the clip's `scrollHeight`.
 */
function neededHeight(card: Element): number {
  const body = card.querySelector<HTMLElement>(".site-priority-body");
  if (!body) return 0;

  const clip = body.querySelector<HTMLElement>(":scope > .grid > *");
  const clipped = clip ? clip.scrollHeight - clip.clientHeight : 0;
  const rule = card.querySelector("span[aria-hidden]");
  const ruleBottom = rule
    ? rule.getBoundingClientRect().bottom - card.getBoundingClientRect().top
    : 0;
  const inset = parseFloat(getComputedStyle(body).bottom) || 0;

  return ruleBottom + RULE_GAP + body.offsetHeight + clipped + inset;
}

/**
 * The row's height is a share of the viewport's and the description that opens
 * on hover is as tall as the card is narrow, so the two disagree once the
 * window is small enough and the description runs out the top of the card.
 * Grows the row by what the worst card is short, out of the room the step is
 * not using.
 *
 * The cap is what keeps the rest of the screen still: the step never scrolls,
 * and the eyebrow, the footer and the progress track sit outside this band and
 * cannot move at all. Measured at rest, so a card opening never resizes its
 * row-mates.
 */
export function usePriorityRowFit<T extends HTMLElement>() {
  const [row, setRow] = useState<T | null>(null);

  useEffect(() => {
    if (!row) return;

    const centred = row.parentElement?.parentElement;
    const firstBand = centred?.firstElementChild;
    if (!centred || !(firstBand instanceof HTMLElement)) return;

    const measure = () => {
      row.style.removeProperty("height");
      if (window.matchMedia("(hover: none)").matches) return;

      const short = Math.max(
        0,
        ...Array.from(
          row.children,
          (card) => neededHeight(card) - card.clientHeight,
        ),
      );
      if (short === 0) return;

      // The step centres its bands, so the room it is not using splits evenly
      // above and below them. Off `offsetTop`, because the entry animation
      // translates these boxes and a rect read mid-rise reports room that is
      // not there.
      const spare = 2 * (firstBand.offsetTop - centred.offsetTop);
      // Two rows of cards below `lg` share whatever the row is given.
      const rows = getComputedStyle(row).gridTemplateRows.split(" ").length;
      const grow = Math.min(short * rows, spare);
      if (grow > 0) row.style.height = `${row.clientHeight + grow}px`;
    };

    measure();

    // How far the description wraps follows the card's width and the webfont,
    // and neither of those resizes the row.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });

    if (typeof ResizeObserver === "undefined") {
      return () => {
        live = false;
      };
    }

    // The centred box rather than the row, which is what this writes to.
    const observer = new ResizeObserver(measure);
    observer.observe(centred);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [row]);

  return setRow;
}
