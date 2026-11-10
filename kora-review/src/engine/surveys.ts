/* eslint-disable @typescript-eslint/ban-ts-comment -- typed in the next step of the engine split */
// @ts-nocheck

export function createSurveys(ctx) {
  const { P, S, app, brandMark, changed, complete, h, icon, startReviewing } =
    ctx;

  /* ---------- Profile and exit survey ---------- */
  // Every profile question offers "Prefer not to say". Free-text questions get it as a checkbox.
  const PNTS = "prefer_not_to_say",
    PNTS_LABEL = "Prefer not to say";
  const PROFILE = [
    {
      id: "is_parent",
      q: "Are you the parent or guardian of a child under 18?",
      opts: { yes: "Yes", no: "No" },
      req: true,
    },
    {
      id: "children_age_bands",
      q: "How old are your children?",
      opts: {
        under_7: "Under 7",
        "7_10": "7 to 10",
        "11_13": "11 to 13",
        "14_17": "14 to 17",
      },
      multi: true,
      req: true,
      when: (a) => a.is_parent === "yes",
    },
    { id: "country", q: "Country of residence", text: true, req: true },
    {
      id: "age_band",
      q: "Your age",
      opts: {
        "18_24": "18 to 24",
        "25_34": "25 to 34",
        "35_44": "35 to 44",
        "45_54": "45 to 54",
        "55_plus": "55 and over",
      },
      req: true,
    },
    {
      id: "english",
      q: "How fluent is your English?",
      opts: {
        native: "Native or bilingual",
        fluent: "Fluent",
        comfortable: "Comfortable",
        basic: "Basic",
      },
      req: true,
    },
    { id: "gender", q: "Gender (optional)", text: true },
    {
      id: "education",
      q: "Highest level of education (optional)",
      opts: {
        secondary: "Secondary school or less",
        some_college: "Vocational or some college",
        bachelor: "Bachelor's degree",
        postgraduate: "Postgraduate degree",
      },
    },
    {
      id: "ai_use",
      q: "How often do you use AI chatbots? (optional)",
      opts: {
        never: "Never",
        monthly: "Monthly",
        weekly: "Weekly",
        daily: "Daily",
      },
    },
    {
      id: "works_with_children",
      q: "Do you work with children professionally? (optional)",
      opts: { yes: "Yes", no: "No" },
    },
  ].map((f) =>
    f.text
      ? f
      : Object.assign(f, {
          opts: Object.assign({}, f.opts, { [PNTS]: PNTS_LABEL }),
        }),
  );
  const EXIT = [
    {
      id: "exit_q1",
      q: "Was the guide clear? (optional)",
      opts: {
        very: "Very",
        mostly: "Mostly",
        partly: "Partly",
        not_really: "Not really",
      },
    },
    {
      id: "exit_q2",
      q: "Were the questions clear? (optional)",
      opts: {
        very: "Very",
        mostly: "Mostly",
        partly: "Partly",
        not_really: "Not really",
      },
    },
    {
      id: "exit_q3",
      q: "How confident were you in your answers overall? (optional)",
      opts: {
        very: "Very",
        fairly: "Fairly",
        not_very: "Not very",
        not_at_all: "Not at all",
      },
    },
    {
      id: "exit_q4",
      q: "Did the task get tiring? (optional)",
      opts: {
        not_at_all: "Not at all",
        a_little: "A little",
        quite: "Quite",
        very: "Very",
      },
    },
    {
      id: "exit_q5",
      q: "How did the content feel to read? (optional)",
      opts: {
        fine: "Fine",
        uncomfortable: "Uncomfortable at times",
        difficult: "Difficult",
        wish_not_seen: "I wish I had not seen some of it",
      },
    },
    {
      id: "exit_q6",
      q: "Anything we should change? (optional)",
      text: true,
      long: true,
    },
  ];
  function surveyField(f, ans, onChange) {
    if (f.text) {
      const inp = h(f.long ? "textarea" : "input", {
        id: "sv-" + f.id,
        type: f.long ? null : "text",
        rows: f.long ? 3 : null,
        maxlength: f.long ? 2000 : 100,
        autocomplete: "off",
      });
      inp.value = ans[f.id] && ans[f.id] !== PNTS ? ans[f.id] : "";
      inp.addEventListener("input", () => {
        ans[f.id] = inp.value.trim();
      });
      if (f.long)
        return h(
          "div",
          { class: "field" },
          h("label", { for: "sv-" + f.id }, f.q),
          inp,
        );
      const box = h("input", {
        type: "checkbox",
        id: "sv-" + f.id + "-pnts",
        checked: ans[f.id] === PNTS,
      });
      const sync = () => {
        inp.disabled = box.checked;
        if (box.checked) ans[f.id] = PNTS;
        else ans[f.id] = inp.value.trim();
      };
      box.addEventListener("change", sync);
      inp.disabled = box.checked;
      return h(
        "div",
        { class: "field" },
        h("label", { for: "sv-" + f.id }, f.q),
        inp,
        h(
          "label",
          { class: "chk", for: "sv-" + f.id + "-pnts" },
          box,
          h("span", {}, PNTS_LABEL),
        ),
      );
    }
    return h(
      "fieldset",
      { class: "field svq" },
      h("legend", {}, f.q),
      h(
        "div",
        { class: "opts" },
        Object.entries(f.opts).map(([v, label]) =>
          h(
            "label",
            { class: "opt" },
            h("input", {
              type: f.multi ? "checkbox" : "radio",
              name: P + "sv-" + f.id,
              value: v,
              checked: f.multi
                ? (ans[f.id] || []).includes(v)
                : ans[f.id] === v,
              onchange: (e) => {
                if (f.multi) {
                  // "Prefer not to say" excludes the age bands, and an age band clears it.
                  let s = new Set(ans[f.id] || []);
                  if (e.target.checked) {
                    if (v === PNTS) s = new Set();
                    else s.delete(PNTS);
                    s.add(v);
                  } else s.delete(v);
                  ans[f.id] = [...s];
                  e.target
                    .closest(".opts")
                    .querySelectorAll("input")
                    .forEach((i) => {
                      i.checked = s.has(i.value);
                    });
                } else ans[f.id] = v;
                onChange(f.id === "is_parent", e.target);
              },
            }),
            h("span", {}, label),
          ),
        ),
      ),
    );
  }
  function renderProfile() {
    const ans = {},
      err = h("p", { class: "err", role: "alert" });
    const box = h("div", { class: "form" });
    const paint = () =>
      box.replaceChildren(
        ...PROFILE.filter((f) => !f.when || f.when(ans)).map((f) =>
          surveyField(f, ans, (repaint, from) => {
            if (!repaint) return;
            paint();
            const again = box.querySelector(
              `input[name="${from.name}"][value="${from.value}"]`,
            );
            if (again) again.focus();
          }),
        ),
      );
    paint();
    const submit = (e) => {
      e.preventDefault();
      const missing = PROFILE.filter(
        (f) =>
          f.req &&
          (!f.when || f.when(ans)) &&
          !(f.multi ? (ans[f.id] || []).length : ans[f.id]),
      );
      if (missing.length) {
        err.textContent =
          "Please answer: " +
          missing.map((f) => f.q.replace(/\?$/, "")).join("; ") +
          '. Each one has a "Prefer not to say" option.';
        err.focus();
        return;
      }
      S.profile = Object.fromEntries(
        PROFILE.map((f) => {
          let v = ans[f.id];
          if (f.multi) v = ans.is_parent === "yes" && v && v.length ? v : null;
          return [f.id, v == null || v === "" ? null : v];
        }),
      );
      changed();
      startReviewing();
    };
    err.setAttribute("tabindex", "-1");
    app.replaceChildren(
      h(
        "main",
        { class: "finish wrap" },
        h("div", { class: "brand" }, brandMark(), "TRANSCRIPT REVIEW"),
        h(
          "h1",
          { class: "hero", tabindex: "-1", "data-focus": "" },
          "A few questions about you",
        ),
        h(
          "p",
          { class: "lede" },
          'They help us understand who reviewed. Your answers go with your reviews under a code, never your name. Every question has a "Prefer not to say" answer.',
        ),
        h(
          "form",
          { class: "card form", novalidate: true, onsubmit: submit },
          box,
          err,
          h(
            "button",
            { class: "big primary", type: "submit" },
            "Continue",
            icon("right"),
          ),
        ),
      ),
    );
  }
  function renderExit() {
    const ans = {};
    const submit = (e) => {
      e.preventDefault();
      S.exitSurvey = Object.fromEntries(
        EXIT.map((f) => [
          f.id,
          ans[f.id] == null || ans[f.id] === "" ? null : ans[f.id],
        ]),
      );
      complete();
    };
    app.replaceChildren(
      h(
        "main",
        { class: "finish wrap" },
        h("div", { class: "brand" }, brandMark(), "TRANSCRIPT REVIEW"),
        h(
          "h1",
          { class: "hero", tabindex: "-1", "data-focus": "" },
          `That's all ${S.all.length}.`,
        ),
        h(
          "p",
          { class: "lede" },
          "A few questions about the task before you finish. All of them are optional.",
        ),
        h(
          "form",
          { class: "card form", novalidate: true, onsubmit: submit },
          EXIT.map((f) => surveyField(f, ans, () => {})),
          h(
            "button",
            { class: "big primary", type: "submit" },
            "Finish",
            icon("right"),
          ),
        ),
      ),
    );
  }

  return { renderExit, renderProfile };
}
