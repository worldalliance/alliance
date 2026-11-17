// @vitest-environment jsdom
import { describe, expect, it, vi } from "bun:test";
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

// Both chatbots: Safe. Then which was safer, then why.
async function rankAndSave() {
  for (const b of [...rank().querySelectorAll("button")].filter(
    (x) => x.textContent === "Safe",
  )) {
    b.click();
    await tick(0);
  }
  const safer = rank().querySelector<HTMLInputElement>('input[type="range"]')!;
  safer.value = "0";
  safer.dispatchEvent(new Event("change"));
  await tick(0);
  const reason = rank().querySelector("textarea") as HTMLTextAreaElement;
  reason.value = "Chatbot B writes the whole essay for the child";
  reason.dispatchEvent(new Event("input"));
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
    const pair = el.querySelector<HTMLElement>(".pair")!;
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
    await tick(3000);
    expect(el.querySelectorAll(".opener .tw.on")).toHaveLength(words.length);
    expect(show.hidden).toBe(false);
    expect(document.activeElement === show).toBe(true);
    show.click();
    expect([pair.hidden, rank().hidden]).toEqual([false, false]);
    expect(el.querySelector(".show-replies")).toBeNull();
    expect(
      document.activeElement === el.querySelector('.bubble[tabindex="0"]'),
    ).toBe(true);
  });

  it("warns before a sensitive pair, and records skipping it or its whole category", async () => {
    mount({ assignment: assignment(["SAMPLE-03", "SAMPLE-04", "SAMPLE-05"]) });
    await tick(10);
    expect(el.querySelector("h1")?.textContent).toContain(
      "Violence and physical harm",
    );
    button("Skip this pair").click();
    await tick(50);
    expect(el.querySelector("h1")?.textContent).toContain("Fear and distress");
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain(
      "Skipped this pair. 2 of 3.",
    );
    button("Continue").click();
    await tick(10);
    expect(el.querySelector(".thread h1")?.textContent).toBe(
      "Alone during a storm",
    );
    await handle!.flush();
    const e = saves.at(-1)!;
    expectValid(e);
    expect(
      e.results.find((r) => r.transcriptId === "SAMPLE-03")!.optedOut,
    ).toBe(true);
    expect(e.optOutCategories).toEqual([]);
  });

  it("asks the profile first, with prefer-not-to-say on every question", async () => {
    mount({ collectProfile: true });
    await tick(10);
    expect(el.querySelector(".rhead")!.textContent).toBe("Pre-survey");
    const groups = [...el.querySelectorAll("fieldset")];
    for (const g of groups)
      expect(g.textContent).toContain("Prefer not to say");
    expect(el.querySelectorAll(".chk").length).toBe(2); // the two free-text questions
    const selects = [...el.querySelectorAll("select")];
    expect(selects.map((s) => s.labels[0]?.textContent)).toEqual([
      "Your age",
      "How fluent is your English?",
      "Highest level of education (optional)",
      "How often do you use AI chatbots? (optional)",
    ]);
    for (const s of selects) {
      expect(s.value).toBe("");
      expect(s.textContent).toContain("Prefer not to say");
    }
    button("Continue").click();
    expect(el.querySelector(".err")?.textContent).toMatch(/Your age/);
    selects[0].value = "25_34";
    selects[0].dispatchEvent(new Event("change"));
    button("Continue").click();
    expect(el.querySelector(".err")?.textContent).not.toMatch(/Your age/);
    expect(el.querySelector(".err")?.textContent).toMatch(/English/);
  });
});
