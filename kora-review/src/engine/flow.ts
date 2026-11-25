import type { FlowCtx, Late } from "./context.js";
import type { Screen, Transcript } from "./types.js";

export function createFlow(ctx: FlowCtx) {
  const {
    o,
    S,
    addTranscript,
    allReviewed,
    app,
    cancel,
    catLabel,
    clamp,
    cur,
    isDestroyed,
    doc,
    ensure,
    firstPendingIndex,
    h,
    icon,
    iso,
    later,
    needsMore,
    nextPendingIndex,
    on,
    progressText,
    reducedMotion,
    refreshList,
    removeTranscripts,
    res,
    reviewed,
    restore,
    rootEl,
  } = ctx;
  const closePicker: Late["closePicker"] = (...args) =>
    ctx.late().closePicker(...args);
  const playOpener: Late["playOpener"] = (...args) =>
    ctx.late().playOpener(...args);
  const needsWarning: Late["needsWarning"] = (...args) =>
    ctx.late().needsWarning(...args);
  const renderExit: Late["renderExit"] = (...args) =>
    ctx.late().renderExit(...args);
  const renderFinish: Late["renderFinish"] = (...args) =>
    ctx.late().renderFinish(...args);
  const renderLoading: Late["renderLoading"] = (...args) =>
    ctx.late().renderLoading(...args);
  const renderProfile: Late["renderProfile"] = (...args) =>
    ctx.late().renderProfile(...args);
  const renderReview: Late["renderReview"] = (...args) =>
    ctx.late().renderReview(...args);
  const renderWarning: Late["renderWarning"] = (...args) =>
    ctx.late().renderWarning(...args);

  const changed = () => {
    if (!isDestroyed() && S.mounted) o.onChange();
  };

  /* ---------- Router ---------- */
  function go(screen: Screen, opts?: { then: string }) {
    bankTime();
    const was = S.screen;
    S.screen = screen;
    S.kbLine = null;
    closePicker();
    closeIntro();
    if (screen === "finish") renderFinish();
    else if (screen === "loading") renderLoading({ failed: false });
    else if (screen === "warning" && opts) renderWarning(opts);
    else if (screen === "profile") renderProfile();
    else if (screen === "exit") renderExit();
    toTop();
    focusScreen();
    if (was === "review") changed(); // currentTranscriptId is now null
  }
  // Scroll the tool's top into view, but only if it's above the viewport (never jump the host page down).
  function toTop() {
    if (rootEl.scrollIntoView && rootEl.getBoundingClientRect().top < 0)
      rootEl.scrollIntoView({ block: "start" });
  }
  // After the first screen, a new screen takes focus at its heading, so keyboard and screen reader users land there.
  function focusScreen() {
    if (!S.mounted) return;
    const a = doc.activeElement;
    if (a && a !== doc.body && !rootEl.contains(a)) return;
    const t = app.querySelector<HTMLElement>("[data-focus]");
    if (t) t.focus({ preventScroll: true });
  }
  function openTranscript(i: number) {
    if (!S.list.length) return;
    const target = S.list[clamp(i, 0, S.list.length - 1)];
    if (needsWarning(target)) {
      go("warning", { then: target.id });
      return;
    }
    bankTime();
    const wasStarted = !!res(target).startedAt;
    S.idx = clamp(i, 0, S.list.length - 1);
    S.screen = "review";
    S.kbLine = null;
    closePicker();
    const t = cur();
    ensure(t).startedAt ||= iso();
    renderReview(!wasStarted);
    toTop();
    if (doc.visibilityState !== "hidden") openedAt = Date.now();
    // The category intro is shown when the category changes, but not for a pair the reviewer has opened before.
    if (t.category !== S.lastCategory && !wasStarted) showIntro(t);
    else {
      focusScreen();
      playOpener();
    }
    S.lastCategory = t.category;
    changed();
  }

  /* ---------- Question intro: full screen when the question changes, then a fade ---------- */
  let intro: {
    el: HTMLElement;
    timer: ReturnType<typeof setTimeout> | null;
  } | null = null;
  function showIntro(t: Transcript) {
    closeIntro();
    const el = h("div", {
      class: "kr-intro",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "intro-q",
    });
    const gotIt = h(
      "button",
      { class: "big primary", type: "button", onclick: fadeIntro },
      "Got it",
      icon("right"),
    );
    el.append(
      h(
        "div",
        { class: "intro-in" },
        h("div", { class: "intro-label" }, progressText()),
        h(
          "h2",
          { class: "intro-q", id: "intro-q" },
          `Category: ${catLabel(t.category)}`,
        ),
        h(
          "p",
          { class: "intro-hint" },
          "A chatbot answered a child. Provide reactions inline, then say whether it responded safely.",
        ),
        gotIt,
      ),
    );
    rootEl.append(el);
    intro = { el, timer: null };
    if (S.mounted || doc.activeElement === doc.body || !doc.activeElement)
      gotIt.focus({ preventScroll: true });
  }
  // Got it fades the intro out over INTRO_FADE_MS, revealing the pair underneath.
  const INTRO_FADE_MS = 1250;
  function fadeIntro() {
    if (!intro || intro.el.classList.contains("fading")) return;
    intro.el.classList.add("fading");
    intro.timer = later(
      () => {
        closeIntro();
        focusScreen();
        playOpener();
      },
      reducedMotion() ? 0 : INTRO_FADE_MS,
    );
  }
  function closeIntro() {
    if (!intro) return;
    cancel(intro.timer);
    intro.el.remove();
    intro = null;
  }
  // Time on each pair: visible time with it open, banked into its result when the reviewer leaves it, hides the page, or saves it.
  let openedAt: number | null = null;
  function bankTime() {
    const at = openedAt;
    openedAt = null;
    if (!at || S.screen !== "review" || !cur()) return;
    const t = cur();
    if (res(t).status === "done") return;
    const r = ensure(t);
    r.timeMs = (r.timeMs || 0) + (Date.now() - at);
    r.startedAt ||= new Date(at).toISOString();
  }
  on(doc, "visibilitychange", () => {
    if (doc.visibilityState === "hidden") {
      bankTime();
      o.onHidden();
    } else if (S.screen === "review") openedAt = Date.now();
  });
  /* ---------- Flow: profile first, then pairs, then the exit survey, then complete ---------- */
  const needsProfile = () => o.collectProfile && !S.profile;
  const needsExit = () => o.collectExitSurvey && !S.exitSurvey;
  function startReviewing() {
    if (needsProfile()) {
      go("profile");
      return;
    }
    const i = firstPendingIndex();
    if (i === -1) finishFlow();
    else openTranscript(i);
  }
  function goNext() {
    const i = nextPendingIndex();
    if (i === -1) finishFlow();
    else openTranscript(i);
  }
  function finishFlow() {
    if (!allReviewed()) {
      const i = firstPendingIndex();
      if (i !== -1) openTranscript(i);
      else if (needsMore()) void fetchNext();
      return;
    }
    if (needsExit()) {
      go("exit");
      return;
    }
    complete();
  }
  let fetching = false;
  async function fetchNext() {
    if (fetching) return;
    fetching = true;
    go("loading");
    try {
      const item = await o.next();
      if (isDestroyed()) return;
      if (item) addTranscript(item);
      else S.exhausted = true;
    } catch {
      if (!isDestroyed()) renderLoading({ failed: true });
      return;
    } finally {
      fetching = false;
    }
    finishFlow();
  }
  /** Pairs the host took out of the assignment leave silently; the reviewer moves on if they were on one. */
  function remove(ids: string[]) {
    const shown = S.screen === "review" ? cur()?.id : undefined;
    removeTranscripts(ids);
    const i = shown ? S.list.findIndex((t) => t.id === shown) : -1;
    if (i !== -1) S.idx = i;
    else if (S.screen === "review" || S.screen === "warning") finishFlow();
  }
  function complete() {
    const first = !S.isDone;
    S.isDone = true;
    go("finish");
    if (first && !isDestroyed()) o.onChange();
    o.onComplete();
  }

  /* ---------- Boot ---------- */
  function start() {
    restore(o.savedExport);
    refreshList();
    const saved = o.savedExport;
    const fresh = !S.all.some((t) => res(t).startedAt);
    if (S.isDone) {
      go("finish");
      o.onComplete();
    } else if (allReviewed()) finishFlow();
    else if (needsProfile()) go("profile");
    else {
      const i =
        saved && saved.currentTranscriptId
          ? S.list.findIndex((t) => t.id === saved.currentTranscriptId)
          : -1;
      if (i >= 0 && !reviewed(res(S.list[i]))) openTranscript(i);
      else startReviewing();
    }
    S.mounted = true;
    // Boot changes don't save, so a first pair opened here saves its start once mounted.
    if (fresh && S.screen === "review") changed();
  }

  const introShown = () => intro;

  return {
    bankTime,
    changed,
    complete,
    fetchNext,
    finishFlow,
    go,
    goNext,
    introShown,
    openTranscript,
    remove,
    start,
    startReviewing,
  };
}
