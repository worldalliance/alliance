import { parseKoraFeedback } from "../parse.js";
import type { FeedbackFormCtx } from "./context.js";

type Answers = Record<string, string | undefined>;

type Field = {
  id: string;
  q: string;
  opts?: Record<string, string>;
  long?: boolean;
  when?: (answers: Answers) => boolean;
};

const FOUR = {
  not_at_all: "Not at all",
  not_really: "Not really",
  mostly: "Mostly",
  fully: "Fully",
};
const YES_NO = { yes: "Yes", no: "No" };

/** F1 to F7 of Annex A7. Every question is optional. */
const FIELDS: Field[] = [
  {
    id: "f1",
    q: "Were the instructions and the risk guide clear enough to answer?",
    opts: FOUR,
  },
  {
    id: "f2",
    q: "How hard was it to decide between OK and Not OK?",
    opts: {
      very_easy: "Very easy",
      easy: "Easy",
      hard: "Hard",
      very_hard: "Very hard",
    },
  },
  {
    id: "f3",
    q: "Was there a conversation where neither OK nor Not OK fit?",
    opts: YES_NO,
  },
  {
    id: "f3Text",
    q: "Which one, and why?",
    long: true,
    when: (answers) => answers.f3 === "yes",
  },
  {
    id: "f4",
    q: "Did the children in the conversations sound like real children of that age?",
    opts: FOUR,
  },
  {
    id: "f5",
    q: "Did any conversation upset you, or seem inappropriate to show to reviewers?",
    opts: YES_NO,
  },
  {
    id: "f5Text",
    q: "Which one?",
    long: true,
    when: (answers) => answers.f5 === "yes",
  },
  {
    id: "f6",
    q: "Did the session take about the time announced?",
    opts: {
      shorter: "Shorter",
      about_right: "About right",
      longer: "Longer",
    },
  },
  {
    id: "f7",
    q: "Anything else you would like to tell us? About the conversations, the questions, the platform, the topic, anything.",
    long: true,
  },
];

export function createFeedbackForm(ctx: FeedbackFormCtx) {
  const { S, app, brandMark, finishFeedback, h, icon, iso, P } = ctx;

  function field(
    f: Field,
    answers: Answers,
    repaint: (from: HTMLInputElement) => void,
  ) {
    if (f.long) {
      const box = h("textarea", {
        id: "fb-" + f.id,
        rows: 3,
        maxlength: 2000,
      });
      box.value = answers[f.id] ?? "";
      box.addEventListener("input", () => {
        answers[f.id] = box.value.trim();
      });
      return h(
        "div",
        { class: "field" },
        h("label", { for: "fb-" + f.id }, f.q),
        box,
      );
    }
    return h(
      "fieldset",
      { class: "field svq" },
      h("legend", {}, f.q),
      h(
        "div",
        { class: "opts" },
        Object.entries(f.opts ?? {}).map(([value, label]) =>
          h(
            "label",
            { class: "opt" },
            h("input", {
              type: "radio",
              name: P + "fb-" + f.id,
              value,
              checked: answers[f.id] === value,
              onchange: (e) => {
                const input = e.target;
                if (!(input instanceof HTMLInputElement)) return;
                answers[f.id] = value;
                repaint(input);
              },
            }),
            h("span", {}, label),
          ),
        ),
      ),
    );
  }

  function renderFeedbackForm() {
    const answers: Answers = {};
    const box = h("div", { class: "form" });
    const paint = () =>
      box.replaceChildren(
        ...FIELDS.filter((f) => !f.when || f.when(answers)).map((f) =>
          field(f, answers, (from) => {
            paint();
            box
              .querySelector<HTMLElement>(
                `input[name="${from.name}"][value="${from.value}"]`,
              )
              ?.focus();
          }),
        ),
      );
    paint();
    const keep = (skip: boolean) => {
      S.feedback = skip
        ? null
        : parseKoraFeedback({
            answeredAt: iso(),
            ...Object.fromEntries(
              FIELDS.map((f) => [f.id, answers[f.id] || null]),
            ),
          });
      finishFeedback();
    };
    app.replaceChildren(
      h(
        "main",
        { class: "finish wrap" },
        h("div", { class: "brand" }, brandMark(), "CONVERSATION REVIEW"),
        h(
          "h1",
          { class: "hero", tabindex: "-1", "data-focus": "" },
          "That's the session",
        ),
        h(
          "p",
          { class: "lede" },
          "Two minutes on how it went, so we can fix what needs fixing. Every question is optional.",
        ),
        h(
          "form",
          {
            class: "card form",
            novalidate: true,
            onsubmit: (e: SubmitEvent) => {
              e.preventDefault();
              keep(false);
            },
          },
          box,
          h(
            "div",
            { class: "oo-acts" },
            h(
              "button",
              { class: "big primary", type: "submit" },
              "Send and finish",
              icon("right"),
            ),
            h(
              "button",
              {
                class: "big ghost",
                type: "button",
                onclick: () => keep(true),
              },
              "Skip this",
            ),
          ),
        ),
      ),
    );
  }

  return { renderFeedbackForm };
}
