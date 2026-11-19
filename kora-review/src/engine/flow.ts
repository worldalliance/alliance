import type { FlowCtx, Late } from "./context.js";
import type { Ended, Screen } from "./types.js";

/** "Next" stays disabled this long on the screens spec 6.0 section 8 asks to slow down. */
export const SOFT_BLOCK_MS = 45_000;

export function createFlow(ctx: FlowCtx) {
  const {
    o,
    S,
    addItem,
    announce,
    app,
    cancel,
    cur,
    doc,
    done,
    ensure,
    isDestroyed,
    iso,
    later,
    on,
    openIndex,
    removeItems,
    res,
    restore,
    rootEl,
    skipped,
  } = ctx;
  const closeSheet: Late["closeSheet"] = (...a) => ctx.late().closeSheet(...a);
  const needsWarning: Late["needsWarning"] = (...a) =>
    ctx.late().needsWarning(...a);
  const renderComplete: Late["renderComplete"] = (...a) =>
    ctx.late().renderComplete(...a);
  const renderEmpty: Late["renderEmpty"] = (...a) =>
    ctx.late().renderEmpty(...a);
  const renderFeedbackForm: Late["renderFeedbackForm"] = (...a) =>
    ctx.late().renderFeedbackForm(...a);
  const renderJudge: Late["renderJudge"] = (...a) =>
    ctx.late().renderJudge(...a);
  const renderLoading: Late["renderLoading"] = (...a) =>
    ctx.late().renderLoading(...a);
  const renderPractice: Late["renderPractice"] = (...a) =>
    ctx.late().renderPractice(...a);
  const renderRead: Late["renderRead"] = (...a) => ctx.late().renderRead(...a);
  const renderWarning: Late["renderWarning"] = (...a) =>
    ctx.late().renderWarning(...a);

  const changed = () => {
    if (!isDestroyed() && S.mounted) o.onChange();
  };

  /* ---------- Time on each screen: only while the page is visible ---------- */
  let openedAt: number | null = null;
  let openedOn: Screen | null = null;
  function bankTime() {
    const at = openedAt,
      screen = openedOn;
    openedAt = null;
    openedOn = null;
    if (!at || !screen || !S.items.length) return;
    const r = ensure(cur());
    const ms = Date.now() - at;
    if (screen === "read") r.timeMsRead += ms;
    else if (screen === "judge") r.timeMsJudge += ms;
  }
  /** Banks the time spent so far without stopping the clock, so a save carries it. */
  function flushTime() {
    const screen = openedOn;
    bankTime();
    if (screen) startClock(screen);
  }
  function startClock(screen: Screen) {
    if (screen !== "read" && screen !== "judge") return;
    if (doc.visibilityState !== "hidden") {
      openedAt = Date.now();
      openedOn = screen;
    }
  }
  /** Time banked on the screen the reviewer is on, including the stretch still running. */
  function screenMs(): number {
    if (!S.items.length) return 0;
    const r = res(cur());
    const banked = S.screen === "read" ? r.timeMsRead : r.timeMsJudge;
    const live = openedAt && openedOn === S.screen ? Date.now() - openedAt : 0;
    return banked + live;
  }
  /** Practice, the reviewer's very first rated conversation, and a first meeting with a risk, are slowed down. */
  function blocks(screen: Screen): boolean {
    if (!S.items.length) return false;
    const item = cur();
    if (item.kind === "practice") return true;
    if (item.position === 1 && o.session.number === 1) return true;
    return screen === "read" && item.firstTimeOnRisk;
  }
  const blockMsLeft = () =>
    blocks(S.screen) ? Math.max(0, SOFT_BLOCK_MS - screenMs()) : 0;
  /** What a screen puts under its disabled Next button while the block runs. */
  const blockHint = () => {
    const left = blockMsLeft();
    return left > 0
      ? `Take a moment to read — Next opens in ${Math.ceil(left / 1000)} s`
      : "";
  };
  /** Repaints the screen's Next button while the soft block runs, then once more as it lifts. */
  function watchBlock(paint: () => void) {
    cancel(blockTimer);
    if (blockMsLeft() <= 0) return;
    blockTimer = later(() => {
      if (isDestroyed()) return;
      const lifting = blockMsLeft() <= 0;
      paint();
      if (lifting) announce("You can go on to the next screen.");
      else watchBlock(paint);
    }, 500);
  }
  let blockTimer: ReturnType<typeof setTimeout> | null = null;

  on(doc, "visibilitychange", () => {
    if (doc.visibilityState === "hidden") {
      bankTime();
      o.onHidden();
    } else startClock(S.screen);
  });

  function go(screen: Screen, opts?: { then: string }) {
    bankTime();
    cancel(blockTimer);
    S.screen = screen;
    S.sel = null;
    S.editing = null;
    closeSheet();
    if (screen === "read") renderRead();
    else if (screen === "judge") renderJudge();
    else if (screen === "practice") renderPractice();
    else if (screen === "feedback") renderFeedbackForm();
    else if (screen === "complete") renderComplete();
    else if (screen === "empty") renderEmpty();
    else if (screen === "loading") renderLoading({ failed: false });
    else if (screen === "warning" && opts) renderWarning(opts);
    startClock(screen);
    toTop();
    focusScreen();
    changed();
  }
  function toTop() {
    if (rootEl.scrollIntoView && rootEl.getBoundingClientRect().top < 0)
      rootEl.scrollIntoView({ block: "start" });
  }
  function focusScreen() {
    if (!S.mounted) return;
    const active = doc.activeElement;
    if (active && active !== doc.body && !rootEl.contains(active)) return;
    const target = app.querySelector<HTMLElement>("[data-focus]");
    if (target) target.focus({ preventScroll: true });
  }

  /* ---------- One conversation, two screens, no way back ---------- */
  function openItem(i: number) {
    if (!S.items.length) return;
    S.idx = Math.max(0, Math.min(i, S.items.length - 1));
    const item = cur();
    if (needsWarning(item)) {
      go("warning", { then: item.conversationId });
      return;
    }
    const r = ensure(item);
    S.guideOpen = item.firstTimeOnRisk;
    go(r.status === "judging" ? "judge" : "read");
  }
  function submitRead() {
    const r = ensure(cur());
    if (r.status !== "reading") return;
    r.readSubmittedAt = iso();
    r.status = "judging";
    go("judge");
  }
  function submitJudge() {
    const item = cur();
    const r = ensure(item);
    if (r.status === "done") return;
    r.completedAt = iso();
    r.status = "done";
    if (item.kind === "practice") go("practice");
    else nextConversation();
  }
  /** After a finished conversation: the one still open, if a resumed session has one, else ask the host. */
  function nextConversation() {
    const i = S.items.findIndex(
      (item) => !done(item) && !skipped(item.conversationId),
    );
    if (i !== -1) {
      openItem(i);
      return;
    }
    if (S.ended) {
      endSession();
      return;
    }
    void fetchNext();
  }
  let fetching = false;
  async function fetchNext() {
    if (fetching) return;
    fetching = true;
    go("loading");
    let ended: Ended | null = null;
    try {
      const next = await o.next();
      if (isDestroyed()) return;
      if ("item" in next) addItem(next.item);
      else ended = next.done;
    } catch {
      if (!isDestroyed()) renderLoading({ failed: true });
      return;
    } finally {
      fetching = false;
    }
    S.ended = ended;
    if (ended === "queue_empty") go("empty");
    else if (ended) endSession();
    else openItem(S.items.length - 1);
  }

  /* ---------- Skipping, from a content warning only ---------- */
  function skip(conversationId: string) {
    const item = S.items.find((i) => i.conversationId === conversationId);
    if (!item || skipped(conversationId)) return;
    S.skips.push({ conversationId, riskId: item.riskId, at: iso() });
    changed();
    announce("Skipped. We won't show you that one.");
    nextConversation();
  }
  function optOutOfRisk(riskId: string) {
    const item = S.items.find((i) => i.riskId === riskId);
    if (item) o.onOptOutRisk(item.riskId);
  }

  function endSession() {
    go("feedback");
  }
  function finishFeedback() {
    S.isDone = true;
    go("complete");
    changed();
  }
  function leave(again: boolean) {
    if (!isDestroyed()) o.onComplete({ again });
  }

  function remove(ids: string[]) {
    const showing = S.items.length ? cur().conversationId : null;
    removeItems(ids);
    if (!S.items.length || (showing && ids.includes(showing)))
      nextConversation();
  }

  /** Resume where the saved export left off, and save once, so the host has the session's first state. */
  function start() {
    restore(o.savedExport);
    const place = o.savedExport ? o.savedExport.place : null;
    const resumed = place
      ? S.items.findIndex((i) => i.conversationId === place.conversationId)
      : -1;
    const i = resumed !== -1 && !done(S.items[resumed]) ? resumed : openIndex();
    S.mounted = true;
    if (S.isDone) go("complete");
    else if (!S.items.length) void fetchNext();
    else if (done(S.items[i])) nextConversation();
    else openItem(i);
    changed();
  }

  return {
    bankTime,
    blockHint,
    blockMsLeft,
    flushTime,
    changed,
    endSession,
    fetchNext,
    finishFeedback,
    go,
    leave,
    nextConversation,
    openItem,
    optOutOfRisk,
    remove,
    screenMs,
    skip,
    start,
    submitJudge,
    submitRead,
    watchBlock,
  };
}
