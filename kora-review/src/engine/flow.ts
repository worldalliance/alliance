import type { FlowCtx, Late } from "./context.js";
import type { Screen, Transcript } from "./types.js";

export function createFlow(ctx: FlowCtx) {
  const {
    o,
    S,
    allReviewed,
    app,
    cancel,
    challengeNodes,
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
    nextPendingIndex,
    on,
    progressText,
    refreshList,
    res,
    restore,
    rootEl,
    win,
  } = ctx;
  const closeSheet: Late["closeSheet"] = (...args) =>
    ctx.late().closeSheet(...args);
  const needsWarning: Late["needsWarning"] = (...args) =>
    ctx.late().needsWarning(...args);
  const renderExit: Late["renderExit"] = (...args) =>
    ctx.late().renderExit(...args);
  const renderFinish: Late["renderFinish"] = (...args) =>
    ctx.late().renderFinish(...args);
  const renderProfile: Late["renderProfile"] = (...args) =>
    ctx.late().renderProfile(...args);
  const renderQueue: Late["renderQueue"] = (...args) =>
    ctx.late().renderQueue(...args);
  const renderReview: Late["renderReview"] = (...args) =>
    ctx.late().renderReview(...args);
  const renderWarning: Late["renderWarning"] = (...args) =>
    ctx.late().renderWarning(...args);
  const renderWelcome: Late["renderWelcome"] = (...args) =>
    ctx.late().renderWelcome(...args);

  const changed = () => {
    if (!isDestroyed() && S.mounted) o.onChange();
  };

  /* ---------- Router ---------- */
  function go(screen: Screen, opts?: { then: string }) {
    bankTime();
    const was = S.screen;
    S.screen = screen;
    S.sel = null;
    S.editing = null;
    closeSheet();
    closeIntro();
    rootEl.classList.toggle("has-foot", false);
    if (screen === "welcome") renderWelcome();
    else if (screen === "queue") renderQueue();
    else if (screen === "finish") renderFinish();
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
    S.sel = null;
    S.editing = null;
    S.noteDraft = "";
    closeSheet();
    const t = cur();
    if (res(t).status !== "done") ensure(t).startedAt ||= iso();
    rootEl.classList.add("has-foot");
    renderReview();
    toTop();
    if (doc.visibilityState !== "hidden") openedAt = Date.now();
    // The question intro is shown when the question changes, but not for a pair the reviewer has opened before.
    if (
      t.challenge !== S.lastChallenge &&
      res(t).status !== "done" &&
      !wasStarted
    )
      showIntro(t);
    else focusScreen();
    S.lastChallenge = t.challenge;
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
        h(
          "div",
          { class: "intro-label" },
          h("span", {}, "What to look for"),
          h("span", { class: "dim" }, progressText()),
        ),
        t.tagline ? h("div", { class: "intro-tag" }, t.tagline) : null,
        h(
          "h2",
          { class: "intro-q", id: "intro-q" },
          challengeNodes(t.challenge),
        ),
        h(
          "p",
          { class: "intro-hint" },
          "Two AIs answered the same child. Mark what each got right and wrong with thumbs, then say which responded more safely.",
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
    const reduce =
      win.matchMedia &&
      win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    intro.timer = later(
      () => {
        closeIntro();
        focusScreen();
      },
      reduce ? 0 : INTRO_FADE_MS,
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
      if (i !== -1) {
        openTranscript(i);
        return;
      }
    }
    if (needsExit()) {
      go("exit");
      return;
    }
    complete();
  }
  function complete() {
    const first = !S.isDone;
    S.isDone = true;
    go("finish");
    if (first && !isDestroyed()) o.onChange();
    o.onComplete();
  }

  // After saving, the stamp shows for ADVANCE_MS and then the tool moves on. Opening a sheet or leaving cancels it.
  const ADVANCE_MS = 750;
  let advance: ReturnType<typeof setTimeout> | null = null;
  function startAdvance() {
    stopAdvance();
    advance = later(() => {
      advance = null;
      goNext();
    }, ADVANCE_MS);
  }
  function stopAdvance() {
    if (advance) {
      cancel(advance);
      advance = null;
    }
  }

  /* ---------- Boot ---------- */
  function start() {
    restore(o.savedExport);
    refreshList();
    const saved = o.savedExport;
    if (S.isDone) {
      go("finish");
      o.onComplete();
    } else if (allReviewed()) finishFlow();
    else if (needsProfile() && !S.all.some((t) => res(t).startedAt))
      go("welcome");
    else if (needsProfile()) go("profile");
    else {
      const i =
        saved && saved.currentTranscriptId
          ? S.list.findIndex((t) => t.id === saved.currentTranscriptId)
          : -1;
      if (i >= 0) {
        openTranscript(i);
      } else if (
        S.all.some((t) => res(t).startedAt || res(t).status === "done")
      )
        startReviewing();
      else go("welcome");
    }
    S.mounted = true;
  }

  const introShown = () => intro;

  return {
    bankTime,
    changed,
    complete,
    finishFlow,
    go,
    goNext,
    introShown,
    openTranscript,
    start,
    startAdvance,
    startReviewing,
    stopAdvance,
  };
}
