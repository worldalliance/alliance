import { COUNTRY_CODES } from "../countries.js";
import { parseKoraExitSurvey, parseKoraProfile } from "../parse.js";
import type { SurveysCtx } from "./context.js";

type SurveyAnswers = Record<string, string | string[] | undefined>;

type SurveyField = {
  id: string;
  q: string;
  opts?: Record<string, string>;
  multi?: boolean;
  dropdown?: boolean;
  text?: boolean;
  when?: (a: SurveyAnswers) => boolean;
};

export function createSurveys(ctx: SurveysCtx) {
  const {
    P,
    S,
    app,
    brandMark,
    changed,
    complete,
    h,
    icon,
    topBar,
    startReviewing,
  } = ctx;

  /* ---------- Profile and exit survey ---------- */
  const PNTS = "prefer_not_to_say",
    PNTS_LABEL = "Prefer not to say";
  const countryName = new Intl.DisplayNames(["en"], { type: "region" });
  const COUNTRIES = Object.fromEntries(
    COUNTRY_CODES.map((c) => [c, countryName.of(c) ?? c] as const).sort(
      (a, b) => a[1].localeCompare(b[1], "en"),
    ),
  );
  const PROFILE_FIELDS: SurveyField[] = [
    {
      id: "age_band",
      q: "Your age",
      dropdown: true,
      opts: {
        "18to29": "18 to 29",
        "30to39": "30 to 39",
        "40to49": "40 to 49",
        "50to59": "50 to 59",
        "60plus": "60 and over",
      },
    },
    {
      id: "gender",
      q: "Gender",
      opts: { woman: "Woman", man: "Man", other: "Other" },
    },
    {
      id: "country",
      q: "Country of residence",
      dropdown: true,
      opts: COUNTRIES,
    },
    {
      id: "us_region",
      q: "Which part of the United States?",
      opts: {
        northeast: "Northeast",
        midwest: "Midwest",
        south: "South",
        west: "West",
      },
      when: (a) => a.country === "US",
    },
    {
      id: "is_parent",
      q: "Are you the parent or guardian of a child under 18?",
      opts: { yes: "Yes", no: "No" },
    },
    {
      id: "children_age_bands",
      q: "How old are your children?",
      opts: {
        under7: "Under 7",
        "7to9": "7 to 9",
        "10to12": "10 to 12",
        "13to17": "13 to 17",
      },
      multi: true,
      when: (a) => a.is_parent === "yes",
    },
    {
      id: "child_ai_use",
      q: "Do your children use AI chatbots?",
      opts: {
        never: "Never",
        sometimes: "Sometimes",
        often: "Often",
        dont_know: "Don't know",
      },
      when: (a) => a.is_parent === "yes",
    },
    {
      id: "works_with_children_or_health",
      q: "Do you work professionally with children or in healthcare?",
      opts: { yes: "Yes", no: "No" },
    },
    {
      id: "education",
      q: "Highest level of education",
      dropdown: true,
      opts: {
        high_school_or_less: "High school or less",
        some_college: "Some college",
        bachelors: "Bachelor's degree",
        graduate: "Graduate degree",
      },
    },
    {
      id: "household_income",
      q: "Household income",
      dropdown: true,
      opts: {
        under_50k: "Under $50,000",
        "50k_to_100k": "$50,000 to $100,000",
        "100k_to_150k": "$100,000 to $150,000",
        over_150k: "Over $150,000",
      },
    },
    {
      id: "english",
      q: "How fluent is your English?",
      dropdown: true,
      opts: {
        native_or_bilingual: "Native or bilingual",
        fluent: "Fluent",
        comfortable: "Comfortable",
        basic: "Basic",
      },
    },
  ];
  const GATES = new Set(["country", "is_parent"]);
  const PROFILE: SurveyField[] = PROFILE_FIELDS.map((f) =>
    f.multi
      ? f
      : Object.assign(f, {
          opts: Object.assign({}, f.opts, { [PNTS]: PNTS_LABEL }),
        }),
  );
  const EXIT: SurveyField[] = [
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
    },
  ];
  function surveyField(
    f: SurveyField,
    ans: SurveyAnswers,
    onChange: (
      repaint: boolean,
      from: HTMLInputElement | HTMLSelectElement,
    ) => void,
  ) {
    if (f.text) {
      const inp = h("textarea", {
        id: "sv-" + f.id,
        rows: 3,
        maxlength: 2000,
        autocomplete: "off",
      });
      const given = ans[f.id];
      inp.value = typeof given === "string" ? given : "";
      inp.addEventListener("input", () => {
        ans[f.id] = inp.value.trim();
      });
      return h(
        "div",
        { class: "field" },
        h("label", { for: "sv-" + f.id }, f.q),
        inp,
      );
    }
    if (f.dropdown) {
      const given = ans[f.id];
      const sel = h(
        "select",
        {
          id: "sv-" + f.id,
          onchange: () => {
            ans[f.id] = sel.value || undefined;
            onChange(GATES.has(f.id), sel);
          },
        },
        h("option", { value: "" }, "Choose an answer"),
        Object.entries(f.opts ?? {}).map(([v, label]) =>
          h("option", { value: v, selected: given === v }, label),
        ),
      );
      return h(
        "div",
        { class: "field" },
        h("label", { for: "sv-" + f.id }, f.q),
        sel,
      );
    }
    return h(
      "fieldset",
      { class: "field svq" },
      h("legend", {}, f.q),
      h(
        "div",
        { class: "opts" },
        Object.entries(f.opts ?? {}).map(([v, label]) =>
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
                const input = e.target;
                if (!(input instanceof HTMLInputElement)) return;
                if (f.multi) {
                  const s = new Set(ans[f.id] || []);
                  if (input.checked) s.add(v);
                  else s.delete(v);
                  ans[f.id] = [...s];
                } else ans[f.id] = v;
                onChange(GATES.has(f.id), input);
              },
            }),
            h("span", {}, label),
          ),
        ),
      ),
    );
  }
  function renderProfile() {
    const ans: SurveyAnswers = {};
    const box = h("div", { class: "form" });
    const paint = () =>
      box.replaceChildren(
        ...PROFILE.filter((f) => !f.when || f.when(ans)).map((f) =>
          surveyField(f, ans, (repaint, from) => {
            if (!repaint) return;
            paint();
            const again = box.querySelector<HTMLElement>(
              from instanceof HTMLSelectElement
                ? `#${from.id}`
                : `input[name="${from.name}"][value="${from.value}"]`,
            );
            if (again) again.focus();
          }),
        ),
      );
    paint();
    const submit = (e: SubmitEvent) => {
      e.preventDefault();
      S.profile = parseKoraProfile(
        Object.fromEntries(
          PROFILE.map((f) => {
            const v = !f.when || f.when(ans) ? ans[f.id] : undefined;
            return [f.id, v == null || v.length === 0 ? null : v];
          }),
        ),
      );
      changed();
      startReviewing();
    };
    app.replaceChildren(
      topBar({ stage: "Pre-survey" }),
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
          "They help us understand who reviewed. Every question is optional. Your answers go with your reviews under a code, never your name.",
        ),
        h(
          "form",
          { class: "card form", novalidate: true, onsubmit: submit },
          box,
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
    const ans: SurveyAnswers = {};
    const submit = (e: SubmitEvent) => {
      e.preventDefault();
      S.exitSurvey = parseKoraExitSurvey(
        Object.fromEntries(
          EXIT.map((f) => [
            f.id,
            ans[f.id] == null || ans[f.id] === "" ? null : ans[f.id],
          ]),
        ),
      );
      complete();
    };
    app.replaceChildren(
      topBar({ stage: "Post-survey" }),
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
