import type { FeedbackCtx } from "./context.js";
import type { Valence } from "./types.js";

export function createFeedback(ctx: FeedbackCtx) {
  const {
    $$,
    cancel,
    clamp,
    isDestroyed,
    doc,
    h,
    later,
    markCls,
    raf,
    rootEl,
    toasts,
  } = ctx;

  /* ---------- Toast ---------- */
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  function toast(msg: string) {
    const el = h("div", { class: "toast", role: "status" }, h("span", {}, msg));
    toasts.replaceChildren(el);
    cancel(toastTimer);
    toastTimer = later(() => el.remove(), 5000);
  }
  // Just the value, hovering up from the rated words for a moment and fading out. Positioned inside the root.
  function floatMark(valence: Valence, first: HTMLElement, last: HTMLElement) {
    $$(".toast-v").forEach((el) => el.remove());
    const el = h(
      "div",
      { class: "toast-v v-" + markCls(valence), "aria-hidden": "true" },
      valence === "like" ? "👍" : "👎",
    );
    raf(() => {
      if (isDestroyed() || !first.isConnected) return;
      const rg = doc.createRange();
      rg.setStartBefore(first);
      rg.setEndAfter(last);
      // Centre over the span's first line: the range yields one rect per word, so join those on that line.
      const rs = [...(rg.getClientRects ? rg.getClientRects() : [])].filter(
          (r) => r.width,
        ),
        top = rs.length ? rs[0].top : 0;
      const row = rs.filter((r) => Math.abs(r.top - top) < 4);
      const line = row.length
        ? {
            left: Math.min(...row.map((r) => r.left)),
            width:
              Math.max(...row.map((r) => r.right)) -
              Math.min(...row.map((r) => r.left)),
            top,
          }
        : first.getBoundingClientRect();
      rootEl.append(el);
      const rb = rootEl.getBoundingClientRect();
      const w = el.offsetWidth,
        ht = el.offsetHeight;
      const x = clamp(
        line.left + line.width / 2 - w / 2,
        8,
        Math.max(8, rb.width - w - 8 + rb.left),
      );
      el.style.left = x - rb.left + "px";
      el.style.top = Math.max(line.top - ht - 6 - rb.top, 4) + "px";
      later(() => el.remove(), 1600);
    });
  }

  return { floatMark, toast };
}
