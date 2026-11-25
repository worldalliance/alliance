// @vitest-environment jsdom
import { describe, expect, it, vi } from "bun:test";
import { KoraCategory } from "../src/index.js";
import {
  assignment,
  button,
  buttons,
  el,
  expectValid,
  handle,
  mount,
  pairs,
  rank,
  saves,
  tick,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

async function rankAndSave() {
  button("Safe", rank()).click();
  await tick(0);
  button("4", rank()).click();
  await tick(0);
  const save = button("Save and continue", rank()) as HTMLButtonElement;
  expect(save.disabled).toBe(false);
  save.click();
  await tick(0);
}

describe("mountKoraReview: moving through the pairs", () => {
  it("fires onComplete exactly once, after the exit survey and a save", async () => {
    const opts = mount({
      assignment: assignment(["SAMPLE-01"]),
      collectExitSurvey: true,
    });
    await tick(10);
    button("Got it").click();
    await tick(1300);
    await rankAndSave();

    expect(el.textContent).toContain("A few questions about the task");
    expect(el.querySelector(".rhead")!.textContent).toBe("Post-survey");
    expect(opts.onComplete).not.toHaveBeenCalled();
    button("Finish").click();
    await tick(0);
    await tick(0);
    expect(opts.onComplete).toHaveBeenCalledTimes(1);
    expect(el.querySelector(".mini-stamp")?.textContent).toBe("Safe");
    const last = saves.at(-1)!;
    expect(last.isDone).toBe(true);
    expect(last.exitSurvey).not.toBeNull();
    expect(last.results[0]!.status).toBe("done");
    expectValid(last);
    // onComplete came after the save that holds isDone.
    const saveOrder = (
      opts.save as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder.at(-1)!;
    expect(saveOrder).toBeLessThan(
      (opts.onComplete as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0]!,
    );
  });

  it("opens the next pair as soon as one is saved, and resumes past a saved pair", async () => {
    mount({ assignment: assignment(["SAMPLE-01", "SAMPLE-02"]) });
    await tick(10);
    button("Got it").click();
    await tick(1300);
    await rankAndSave();
    expect(el.querySelector(".rhead")!.textContent).toContain("2 of 2");
    await handle!.flush();
    const saved = saves.at(-1)!;
    expect(saved.currentTranscriptId).toBe("SAMPLE-02");

    handle!.unmount();
    el.replaceChildren();
    mount({
      assignment: assignment(["SAMPLE-01", "SAMPLE-02"]),
      savedExport: { ...saved, currentTranscriptId: "SAMPLE-01" },
    });
    const title = (id: string) =>
      pairs.find((p) => p.transcriptId === id)!.scenarioTitle;
    expect(el.textContent).toContain(title("SAMPLE-02"));
    expect(el.textContent).not.toContain(title("SAMPLE-01"));
  });

  it("types the child's message in on a new pair, then shows the replies on request", async () => {
    mount();
    await tick(10);
    expect(el.querySelector(".kr-intro h2")?.textContent).toMatch(
      /^Category: \S/,
    );
    expect(el.querySelector(".kr-intro")?.textContent).not.toContain(
      "What to look for",
    );
    expect(buttons().some((b) => b.textContent === "Start reviewing")).toBe(
      false,
    );
    const pair = el.querySelector<HTMLElement>(".side")!;
    const show = el.querySelector<HTMLElement>(".show-replies")!;
    const words = el.querySelectorAll(".opener .tw");
    expect(words.length).toBeGreaterThan(1);
    expect([pair.hidden, rank().hidden, show.hidden]).toEqual([
      true,
      true,
      true,
    ]);
    button("Got it", el.querySelector(".kr-intro")!).click();
    await tick(1300 + 300);
    expect(el.querySelector(".opener .typing-dots")).not.toBeNull();
    await tick(300);
    const typed = el.querySelectorAll(".opener .tw.on").length;
    expect(typed).toBeGreaterThan(0);
    expect(el.querySelector(".opener .typing-dots")).toBeNull();
    expect(typed).toBeLessThan(words.length);
    while (el.querySelectorAll(".opener .tw.on").length < words.length)
      await tick(10);
    expect(show.hidden).toBe(true);
    await tick(730);
    expect(show.hidden).toBe(true);
    await tick(120);
    expect(show.hidden).toBe(false);
    expect(document.activeElement === show).toBe(true);
    show.click();
    expect([pair.hidden, rank().hidden]).toEqual([false, false]);
    expect(el.querySelector(".show-replies")).toBeNull();
    expect(
      document.activeElement === el.querySelector('.bubble[tabindex="0"]'),
    ).toBe(true);
  });

  it("warns before a sensitive conversation, offering only to skip its whole category", async () => {
    mount({ assignment: assignment(["SAMPLE-03", "SAMPLE-04", "SAMPLE-05"]) });
    await tick(10);
    expect(el.querySelector("h1")?.textContent).toBe(
      "The next conversation is about violence and physical harm",
    );
    expect(
      [...el.querySelectorAll(".oo-acts button")].map((b) => b.textContent),
    ).toEqual([
      "Continue",
      "Skip all conversations of violence and physical harm",
    ]);
    button("Skip all conversations of violence and physical harm").click();
    await tick(50);
    expect(el.querySelector("h1")?.textContent).toContain("fear and distress");
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain(
      "Skipping all conversations of violence and physical harm. 2 of 3.",
    );
    button("Continue").click();
    await tick(10);
    expect(el.querySelector(".thread h1")?.textContent).toBe(
      "Alone during a storm",
    );
    await handle!.flush();
    const e = saves.at(-1)!;
    expectValid(e);
    const skipped = e.results.find((r) => r.transcriptId === "SAMPLE-03")!;
    expect(skipped.optedOut).toBe(true);
    expect(skipped.optedOutAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(e.optOutCategories).toEqual([KoraCategory.Violence]);
  });

  it("asks the profile first, every question optional, with prefer-not-to-say on all but the children's ages", async () => {
    mount({ collectProfile: true });
    await tick(10);
    expect(el.querySelector(".rhead")!.textContent).toBe("Pre-survey");
    expect(el.querySelector(".lede")!.textContent).toContain(
      "Every question is optional",
    );
    const groups = [...el.querySelectorAll("fieldset")];
    expect(groups.map((g) => g.querySelector("legend")?.textContent)).toEqual([
      "Gender",
      "Are you the parent or guardian of a child under 18?",
      "Do you work professionally with children or in healthcare?",
    ]);
    for (const g of groups)
      expect(g.textContent).toContain("Prefer not to say");
    const selects = [...el.querySelectorAll("select")];
    expect(selects.map((s) => s.labels[0]?.textContent)).toEqual([
      "Your age",
      "Country of residence",
      "Highest level of education",
      "Household income",
      "How fluent is your English?",
    ]);
    for (const s of selects) {
      expect(s.value).toBe("");
      expect(s.textContent).toContain("Prefer not to say");
    }
    expect(
      selects[1].querySelector<HTMLOptionElement>('option[value="KE"]')!.text,
    ).toBe("Kenya");
    button("Continue").click();
    await handle!.flush();
    const e = saves.at(-1)!;
    expectValid(e);
    expect(Object.values(e.profile!).every((v) => v === null)).toBe(true);
  });

  it("asks the follow-ups a parent or a US resident gets", async () => {
    mount({ collectProfile: true });
    await tick(10);
    const pick = (value: string, checked = true) => {
      const i = el.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
      i.checked = checked;
      i.dispatchEvent(new Event("change"));
    };
    const choose = (label: string, value: string) => {
      const s = [...el.querySelectorAll("select")].find(
        (x) => x.labels[0]?.textContent === label,
      )!;
      s.value = value;
      s.dispatchEvent(new Event("change"));
    };
    pick("yes");
    const legends = () =>
      [...el.querySelectorAll("legend")].map((l) => l.textContent);
    expect(legends()).toContain("How old are your children?");
    expect(legends()).toContain("Do your children use AI chatbots?");
    const ages = [...el.querySelectorAll("fieldset")].find((f) =>
      f.textContent.includes("How old are your children?"),
    )!;
    expect(ages.textContent).not.toContain("Prefer not to say");
    pick("7to9");
    pick("under7");
    pick("under7", false);
    pick("dont_know");
    choose("Country of residence", "US");
    expect(document.activeElement?.id).toEndWith("sv-country");
    expect(legends()).toContain("Which part of the United States?");
    pick("midwest");
    choose("Your age", "30to39");
    choose("How fluent is your English?", "fluent");
    button("Continue").click();
    await handle!.flush();
    const e = saves.at(-1)!;
    expectValid(e);
    expect(e.profile).toMatchObject({
      age_band: "30to39",
      country: "US",
      us_region: "midwest",
      is_parent: "yes",
      children_age_bands: ["7to9"],
      child_ai_use: "dont_know",
      english: "fluent",
    });
  });

  it("saves null for follow-ups hidden again", async () => {
    mount({ collectProfile: true });
    await tick(10);
    const pick = (value: string, checked = true) => {
      const i = el.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
      i.checked = checked;
      i.dispatchEvent(new Event("change"));
    };
    const choose = (label: string, value: string) => {
      const s = [...el.querySelectorAll("select")].find(
        (x) => x.labels[0]?.textContent === label,
      )!;
      s.value = value;
      s.dispatchEvent(new Event("change"));
    };
    const legends = () =>
      [...el.querySelectorAll("legend")].map((l) => l.textContent);
    pick("yes");
    pick("7to9");
    choose("Country of residence", "US");
    pick("midwest");
    choose("Country of residence", "KE");
    pick("no");
    expect(legends()).not.toContain("Which part of the United States?");
    expect(legends()).not.toContain("How old are your children?");
    button("Continue").click();
    await handle!.flush();
    const e = saves.at(-1)!;
    expectValid(e);
    expect(e.profile).toMatchObject({
      country: "KE",
      us_region: null,
      is_parent: "no",
      children_age_bands: null,
      child_ai_use: null,
    });
  });
});
