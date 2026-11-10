/* eslint-disable @typescript-eslint/ban-ts-comment -- typed in the next step of the engine split */
// @ts-nocheck

export function createFeedback(ctx) {
  const {
    $$,
    cancel,
    clamp,
    isDestroyed,
    doc,
    fmt,
    h,
    later,
    raf,
    rootEl,
    toasts,
    vcls,
  } = ctx;

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg, undoFn) {
    const el = h(
      "div",
      { class: "toast", role: "status" },
      h("span", {}, msg),
      undoFn
        ? h(
            "button",
            {
              type: "button",
              class: "link",
              onclick: () => {
                toasts.replaceChildren();
                undoFn();
              },
            },
            "Undo",
          )
        : null,
    );
    toasts.replaceChildren(el);
    cancel(toastTimer);
    toastTimer = later(() => el.remove(), 5000);
  }
  // Just the value, hovering up from the rated words for a moment and fading out. Positioned inside the root.
  function floatValue(v, first, last) {
    $$(".toast-v").forEach((el) => el.remove());
    const el = h(
      "div",
      { class: "toast-v " + vcls(v), "aria-hidden": "true" },
      fmt(v),
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

  return { floatValue, toast };
}
