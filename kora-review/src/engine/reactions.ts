import type { Late, ReactionsCtx } from "./context.js";
import type { IconName } from "./runtime.js";
import {
  ReactionKind,
  type Line,
  type Passage,
  type Reaction,
  type View,
} from "./types.js";

const KINDS: ReactionKind[] = [
  ReactionKind.Up,
  ReactionKind.Down,
  ReactionKind.Notable,
];
export const ICON: Record<ReactionKind, IconName> = {
  [ReactionKind.Up]: "up",
  [ReactionKind.Down]: "down",
  [ReactionKind.Notable]: "asterisk",
};
export const LABEL: Record<ReactionKind, string> = {
  [ReactionKind.Up]: "Thumbs up",
  [ReactionKind.Down]: "Thumbs down",
  [ReactionKind.Notable]: "Notable",
};
const KEY_KIND: Partial<Record<string, ReactionKind>> = {
  "1": ReactionKind.Up,
  "2": ReactionKind.Down,
  "3": ReactionKind.Notable,
};
const LONG_PRESS_MS = 450,
  // Taps on one line closer together than this count as one gesture, which acts once they stop.
  TAP_GAP_MS = 320,
  MOVE_PX = 10;

export function createReactions(ctx: ReactionsCtx) {
  const {
    S,
    aiTurn,
    announce,
    changed,
    cur,
    doc,
    h,
    icon,
    later,
    cancel,
    on,
    raf,
    rootEl,
    win,
  } = ctx;
  const renderRank: Late["renderRank"] = (...args) =>
    ctx.late().renderRank(...args);
  const renderReactionList: Late["renderReactionList"] = (...args) =>
    ctx.late().renderReactionList(...args);

  const list = (): Reaction[] => (S.reactions[cur().id] ||= []);

  // A word's box is shorter than the line it sits on, so each line is its block's line-height, centred on its words.
  // Positions are from inside the bubble's border, where its absolutely placed markers start.
  function lines(v: View): Line[] {
    const out: Line[] = [];
    const base = v.bubble.getBoundingClientRect().top + v.bubble.clientTop;
    const heights = new Map<number, number>();
    v.tokens.forEach((tk, i) => {
      const r = tk.el.getBoundingClientRect();
      let lh = heights.get(tk.blk);
      if (lh == null) {
        lh = parseFloat(win.getComputedStyle(tk.el).lineHeight) || r.height;
        heights.set(tk.blk, lh);
      }
      const mid = (r.top + r.bottom) / 2 - base,
        half = Math.max(lh, r.height) / 2;
      const top = mid - half,
        bottom = mid + half,
        prev = out[out.length - 1];
      // Without layout (a hidden reply, or a test DOM) every rect is empty, so each block is one line.
      const wraps = r.height > 0 && top >= prev?.bottom - 2;
      if (prev && v.tokens[prev.last].blk === tk.blk && !wraps) {
        prev.last = i;
        prev.bottom = Math.max(prev.bottom, bottom);
      } else out.push({ first: i, last: i, top, bottom });
    });
    return out;
  }
  function lineAt(ls: Line[], y: number): number {
    let best = 0,
      bd = Infinity;
    ls.forEach((l, i) => {
      const d = y < l.top ? l.top - y : y > l.bottom ? y - l.bottom : 0;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  // A reaction sits on the line its start falls in; the latest wins, so a reflow that joins two lines shows one.
  const onLine = (v: View, l: Line, r: Reaction) =>
    r.mi === v.mi &&
    r.start >= v.tokens[l.first]!.start &&
    r.start < v.tokens[l.last]!.end;
  function kindOn(mi: number, l: Line): ReactionKind | null {
    const v = S.views[mi];
    let k: ReactionKind | null = null;
    if (v) for (const r of list()) if (onLine(v, l, r)) k = r.kind;
    return k;
  }
  function lineText(v: View, from: Line, to: Line): string {
    let s = "";
    for (let k = from.first; k <= to.last; k++) {
      s +=
        v.tokens[k].text + (v.gaps[k] || []).map((g) => g.textContent).join("");
      if (k < to.last && v.tokens[k + 1].blk !== v.tokens[k].blk) s += "\n";
    }
    return s
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim();
  }
  const views = () => Object.values(S.views).sort((a, b) => a.mi - b.mi);

  function passages(): Passage[] {
    const out: Passage[] = [];
    for (const v of views()) {
      const run: Line[] = [];
      const close = () => {
        const first = run[0],
          last = run[run.length - 1];
        if (first && last)
          out.push({
            mi: v.mi,
            turn: aiTurn(cur(), v.mi),
            first,
            last,
            text: lineText(v, first, last),
          });
        run.length = 0;
      };
      for (const l of lines(v)) {
        const k = kindOn(v.mi, l);
        if (k === ReactionKind.Down) run.push(l);
        else if (k) close();
      }
      close();
    }
    return out;
  }

  /** Picking the reaction a line already has removes it. */
  function react(mi: number, line: number, kind: ReactionKind) {
    const v = S.views[mi],
      l = v && lines(v)[line];
    if (l) setKind(mi, line, kindOn(mi, l) === kind ? null : kind);
  }
  function setKind(mi: number, line: number, kind: ReactionKind | null) {
    const v = S.views[mi];
    if (!v) return;
    const l = lines(v)[line];
    if (!l) return;
    const was = kindOn(mi, l);
    if (was === kind) return;
    S.reactions[cur().id] = list().filter((r) => !onLine(v, l, r));
    if (kind)
      list().push({
        mi,
        start: v.tokens[l.first]!.start,
        end: v.tokens[l.last]!.end,
        kind,
      });
    changed();
    // Removing the tip above the replies here would pull them up under the pointer, so it only stops it coming back.
    S.coachDone = true;
    renderReactions();
    renderRank();
    const where = `line ${line + 1} of turn ${aiTurn(cur(), mi)}`;
    announce(
      kind
        ? `${LABEL[kind]} on ${where}.`
        : `Removed ${was ? LABEL[was] : "reaction"} on ${where}.`,
    );
  }

  function renderReactions() {
    if (S.screen !== "review") return;
    for (const v of views()) {
      v.bubble
        .querySelectorAll(".react-mark,.line-focus")
        .forEach((e) => e.remove());
      if (v.bubble.closest("[hidden]")) continue;
      const ls = lines(v);
      ls.forEach((l, i) => {
        const k = kindOn(v.mi, l);
        if (k)
          v.bubble.append(
            h(
              "span",
              {
                class: "react-mark r-" + k,
                style: `top:${l.top}px;height:${l.bottom - l.top}px`,
                "aria-hidden": "true",
              },
              icon(ICON[k]),
            ),
          );
        if (S.kbLine?.mi === v.mi && S.kbLine.line === i)
          v.bubble.append(
            h("span", {
              class: "line-focus",
              style: `top:${l.top}px;height:${l.bottom - l.top}px`,
              "aria-hidden": "true",
            }),
          );
      });
    }
    renderReactionList();
  }
  let picker: { el: HTMLElement; mi: number; line: number } | null = null;
  function openPicker(mi: number, line: number, kb: boolean) {
    closePicker();
    const v = S.views[mi],
      l = v && lines(v)[line];
    if (!l) return;
    const current = kindOn(mi, l);
    const buttons = KINDS.map((k) =>
      h(
        "button",
        {
          type: "button",
          class: "rp-b r-" + k,
          "aria-label": LABEL[k],
          "aria-pressed": String(current === k),
          "data-kind": k,
          onclick: () => {
            closePicker(kb);
            react(mi, line, k);
          },
        },
        icon(ICON[k]),
      ),
    );
    const el = h(
      "div",
      {
        class: "react-picker",
        role: "group",
        "aria-label": "React to this line",
      },
      buttons,
    );
    const br = v.bubble.getBoundingClientRect();
    el.style.top = `${Math.max(8, br.top + v.bubble.clientTop + l.top - 58)}px`;
    el.style.left = `${Math.max(8, br.left)}px`;
    rootEl.append(el);
    picker = { el, mi, line };
    S.kbLine = { mi, line };
    renderReactions();
    if (kb)
      (buttons.find((b) => b.dataset.kind === current) ?? buttons[0]).focus();
  }
  function closePicker(refocus = false) {
    if (!picker) return;
    const { el, mi } = picker;
    picker = null;
    if (!refocus) S.kbLine = null;
    el.remove();
    if (refocus) S.views[mi]?.bubble.focus({ preventScroll: true });
    else renderReactions();
  }

  const viewOf = (target: EventTarget | null) => {
    const b =
      target instanceof Element ? target.closest(".bubble[tabindex]") : null;
    return b ? views().find((v) => v.bubble === b) : undefined;
  };
  const lineFor = (v: View, clientY: number) =>
    lineAt(
      lines(v),
      clientY - v.bubble.getBoundingClientRect().top - v.bubble.clientTop,
    );
  const TAP_KIND: Record<number, ReactionKind | null> = {
    2: ReactionKind.Up,
    3: ReactionKind.Down,
  };
  let taps: {
    mi: number;
    line: number;
    count: number;
    timer: ReturnType<typeof later>;
  } | null = null;
  function settle() {
    const t = taps;
    if (!t) return;
    taps = null;
    cancel(t.timer);
    if (t.count >= 2) setKind(t.mi, t.line, TAP_KIND[t.count] ?? null);
  }
  // A tap on another line finishes the pending gesture first, rather than dropping it.
  function tap(mi: number, line: number, count?: number) {
    const same = taps?.mi === mi && taps.line === line;
    const n = count ?? (same && taps ? taps.count + 1 : 1);
    if (same && taps) cancel(taps.timer);
    else settle();
    taps = { mi, line, count: n, timer: later(settle, TAP_GAP_MS) };
    return n;
  }
  let press: {
    v: View;
    x: number;
    y: number;
    timer: ReturnType<typeof later>;
    fired: boolean;
  } | null = null;
  on(rootEl, "pointerdown", (e: PointerEvent) => {
    if (picker && !picker.el.contains(e.target as Node)) closePicker();
    const v = viewOf(e.target);
    if (!v || e.pointerType !== "touch") return;
    const p = {
      v,
      x: e.clientX,
      y: e.clientY,
      fired: false,
      timer: later(() => {
        p.fired = true;
        openPicker(v.mi, lineFor(v, p.y), false);
      }, LONG_PRESS_MS),
    };
    press = p;
  });
  on(rootEl, "pointermove", (e: PointerEvent) => {
    if (
      press &&
      Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_PX
    ) {
      cancel(press.timer);
      press = null;
    }
  });
  on(rootEl, "pointercancel", () => {
    if (press) cancel(press.timer);
    press = null;
  });
  on(rootEl, "pointerup", (e: PointerEvent) => {
    const p = press;
    press = null;
    if (!p || e.pointerType !== "touch") return;
    cancel(p.timer);
    if (p.fired) return;
    if (tap(p.v.mi, lineFor(p.v, p.y)) > 1) e.preventDefault();
  });
  // A second click would otherwise start selecting a word, a third a paragraph.
  on(rootEl, "mousedown", (e: MouseEvent) => {
    if (e.detail > 1 && viewOf(e.target)) e.preventDefault();
  });
  on(rootEl, "click", (e: MouseEvent) => {
    const v = viewOf(e.target);
    if (!v) return;
    if ((e as PointerEvent).pointerType === "touch") return;
    const line = lineFor(v, e.clientY);
    if (e.detail > 1) {
      closePicker();
      win.getSelection()?.removeAllRanges();
      tap(v.mi, line, e.detail);
      return;
    }
    settle();
    const sel = win.getSelection();
    if (sel && !sel.isCollapsed && v.bubble.contains(sel.anchorNode)) return;
    openPicker(v.mi, line, e.detail === 0);
  });

  on(doc, "keydown", (e: KeyboardEvent) => {
    if (S.screen !== "review") return;
    if (picker && picker.el.contains(e.target as Node)) {
      const bs = [...picker.el.querySelectorAll<HTMLElement>("button")],
        i = bs.indexOf(e.target as HTMLElement);
      if (e.key === "Escape") {
        e.preventDefault();
        closePicker(true);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        bs[
          (i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length
        ]?.focus();
      }
      return;
    }
    if (e.key === "Escape" && picker) {
      e.preventDefault();
      closePicker();
      return;
    }
    const v = viewOf(e.target);
    if (!v || e.target !== v.bubble || e.metaKey || e.ctrlKey || e.altKey)
      return;
    const n = lines(v).length,
      at = S.kbLine?.mi === v.mi ? S.kbLine.line : -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(
        n - 1,
        Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)),
      );
      S.kbLine = { mi: v.mi, line: at < 0 ? 0 : next };
      renderReactions();
      const l = lines(v)[S.kbLine.line];
      v.tokens[l.first]?.el.scrollIntoView({ block: "nearest" });
      announce(`Line ${S.kbLine.line + 1} of ${n}: ${lineText(v, l, l)}`);
      return;
    }
    const line = at < 0 ? 0 : at;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker(v.mi, line, true);
      return;
    }
    const kind = KEY_KIND[e.key];
    if (kind) {
      e.preventDefault();
      S.kbLine = { mi: v.mi, line };
      react(v.mi, line, kind);
    }
  });
  on(win, "scroll", () => closePicker(), { passive: true });
  on(win, "resize", () => {
    closePicker();
    raf(renderReactions);
  });
  void doc.fonts?.ready.then(() => raf(renderReactions));

  return {
    closePicker,
    kindOn,
    lineText,
    lines,
    passages,
    renderReactions,
    views,
  };
}
