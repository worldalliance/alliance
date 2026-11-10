/* eslint-disable @typescript-eslint/ban-ts-comment -- typed in the next step of the engine split */
// @ts-nocheck

let instances = 0;

export function createRuntime(ctx) {
  const { host } = ctx;

  const P = `kr${++instances}-`; // id prefix, unique per mount
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const listeners = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push(() => target.removeEventListener(type, fn, opts));
  };
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const cancel = (id) => {
    if (id != null) {
      clearTimeout(id);
      timers.delete(id);
    }
  };
  const raf = (fn) =>
    win.requestAnimationFrame
      ? win.requestAnimationFrame(fn)
      : setTimeout(fn, 16);
  let destroyed = false;

  /* ---------- Small helpers ---------- */
  function h(tag, props, ...kids) {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (
        k === "id" ||
        k === "for" ||
        k === "aria-describedby" ||
        k === "aria-labelledby"
      )
        e.setAttribute(
          k,
          String(v)
            .split(" ")
            .map((x) => P + x)
            .join(" "),
        );
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity))
      if (kid != null && kid !== false)
        e.append(kid.nodeType ? kid : String(kid));
    return e;
  }
  const ICONS = {
    up: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    down: '<g transform="rotate(180 12 12)"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></g>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    flip: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    trash:
      '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    pencil:
      '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    scale:
      '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    skip: '<path d="m5 4 10 8-10 8V4z"/><path d="M19 5v14"/>',
  };
  function icon(name) {
    const s = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    s.setAttribute("class", "ic");
    s.innerHTML = ICONS[name];
    return s;
  }
  /* ---------- DOM skeleton, all inside the host's element ---------- */
  const rootEl = h("div", { class: "kora-review", "data-kora-review": "" });
  const app = h("div", { class: "kr-app" });
  const scrim = h("div", { class: "kr-scrim", hidden: true });
  const sheetIn = h("div", { class: "wrap sheet-in" });
  const sheetEl = h(
    "div",
    {
      class: "kr-sheet",
      role: "dialog",
      "aria-modal": "false",
      "aria-label": "Annotate",
      hidden: true,
    },
    h("div", { class: "sheet-card" }, sheetIn),
  );
  const toasts = h("div", { class: "kr-toasts" });
  const live = h("div", {
    class: "sr",
    "aria-live": "polite",
    "aria-atomic": "true",
  });
  rootEl.append(app, scrim, sheetEl, toasts, live);
  host.append(rootEl);
  const $ = (id) => rootEl.querySelector("#" + P + id);
  const $$ = (sel) => rootEl.querySelectorAll(sel);
  const setVar = (k, v) => rootEl.style.setProperty(k, v);

  function announce(msg) {
    live.textContent = "";
    later(() => {
      live.textContent = msg;
    }, 30);
  }

  const isDestroyed = () => destroyed;
  function teardown() {
    destroyed = true;
    for (const off of listeners.splice(0)) off();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    rootEl.remove();
  }

  return {
    teardown,
    $,
    $$,
    P,
    announce,
    app,
    cancel,
    doc,
    h,
    icon,
    isDestroyed,
    later,
    on,
    raf,
    rootEl,
    scrim,
    setVar,
    sheetEl,
    sheetIn,
    toasts,
    win,
  };
}
