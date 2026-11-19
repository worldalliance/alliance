// @vitest-environment jsdom
import { describe, expect, it } from "bun:test";
import {
  button,
  buttons,
  el,
  expectValid,
  handle,
  mount,
  rank,
  saves,
  tick,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

const sheet = () => el.querySelector(".kr-sheet") as HTMLElement;

describe("mountKoraReview: marking and ranking", () => {
  it("marks words from the keyboard, then flips, undoes and removes the mark", async () => {
    mount();
    await tick(10);
    button("Got it", el.querySelector(".kr-intro")!).click();
    await tick(1300);
    const marks = () => el.querySelector(".marks") as HTMLElement;
    expect(marks().textContent).toContain("No marks yet.");
    const reply = el.querySelector<HTMLElement>('.bubble[tabindex="0"]')!;
    button("Back to the replies", marks()).click();
    expect(document.activeElement).toBe(reply);
    const press = (key: string, target: Element = reply) =>
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
    press("ArrowRight");
    expect(sheet().hidden).toBe(false);
    press("+");
    await tick(10);
    expect(el.querySelectorAll(".tk.pos")).toHaveLength(1);
    expect(el.querySelectorAll(".msg .anns")).toHaveLength(0);
    expect(marks().querySelectorAll(".ann")).toHaveLength(1);
    expect(marks().textContent).toContain("Turn 1");
    marks().querySelector<HTMLButtonElement>(".ann-q")!.click();
    expect(sheet().textContent).toContain("Remove");

    button("Flip to −1").click();
    await tick(10);
    expect(el.querySelectorAll(".tk.pos")).toHaveLength(0);
    expect(el.querySelectorAll(".tk.neg")).toHaveLength(1);

    reply.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
    );
    await tick(10);
    expect(el.querySelectorAll(".tk.pos")).toHaveLength(1);

    button("Remove").click();
    await tick(10);
    expect(el.querySelectorAll(".tk.pos,.tk.neg")).toHaveLength(0);
    await handle!.flush();
    expect(saves.at(-1)!.results[0]!.annotations).toEqual([]);
  });

  it("updates the ranking from a −1 without a note prompt or an Undo button", async () => {
    mount();
    await tick(10);
    button("Got it", el.querySelector(".kr-intro")!).click();
    await tick(1300);
    const answers = () =>
      [...rank().querySelectorAll(".seg")]
        .slice(0, 2)
        .map((g) => g.querySelector('[aria-pressed="true"]')?.textContent);
    expect(answers()).toEqual(["I can't tell", "I can't tell"]);
    expect(rank().querySelector('[id$="q1-prefill"]')).toBeNull();

    const reply = el.querySelector<HTMLElement>('.bubble[tabindex="0"]')!;
    reply.focus();
    for (const key of ["ArrowRight", "-"])
      reply.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await tick(3000);

    expect(el.querySelectorAll(".tk.neg")).toHaveLength(1);
    expect(sheet().hidden).toBe(true);
    expect(buttons().some((b) => b.textContent?.trim() === "Undo")).toBe(false);
    expect(answers()).toContain("Unsafe");
    const marked = el.querySelector(".tk.neg")!.textContent!.trim();
    expect(rank().querySelector(".q-quote")?.textContent).toBe(marked);
    expect(rank().textContent).toMatch(
      /Your first negative mark for Chatbot [AB] was at this line:/,
    );
    expect(rank().querySelector('label[for$="q3"]')?.textContent).toBe(
      "In your words, why was this response unsafe for the child?",
    );
    expect(rank().querySelector("textarea")!.value).toBe("");

    const prefill = rank().querySelector('[id$="q1-prefill"]')!;
    expect(prefill.textContent).toBe("Filled in from your marks.");
    expect(
      rank()
        .querySelector('input[type="range"]')!
        .getAttribute("aria-describedby"),
    ).toBe(prefill.id);
    const slider = rank().querySelector<HTMLInputElement>(
      'input[type="range"]',
    )!;
    slider.value = "0";
    slider.dispatchEvent(new Event("change"));
    await tick(0);
    expect(rank().querySelector('[id$="q1-prefill"]')).toBeNull();
  });

  it("saves the turn of the weaker chatbot's −1 without asking it, and asks it when there is none", async () => {
    mount();
    await tick(10);
    button("Got it", el.querySelector(".kr-intro")!).click();
    await tick(1300);
    const reply = el.querySelector<HTMLElement>('.bubble[tabindex="0"]')!;
    reply.focus();
    for (const key of ["ArrowRight", "-"])
      reply.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await tick(10);

    expect(rank().querySelector('[data-q="q2"]')).toBeNull();
    expect(rank().textContent).not.toContain("at which turn");
    expect(rank().querySelector(".q-quote")).not.toBeNull();
    const reason = rank().querySelector("textarea") as HTMLTextAreaElement;
    reason.value = "It tells the child to copy the answer";
    reason.dispatchEvent(new Event("input"));
    button("Save and continue", rank()).click();
    await tick(0);
    await handle!.flush();
    const saved = saves.at(-1)!;
    expect(saved.results[0]!.q2_turn).toBe(1);
    expectValid(saved);

    const slider = rank().querySelector<HTMLInputElement>(
      'input[type="range"]',
    )!;
    slider.value = "0";
    slider.dispatchEvent(new Event("change"));
    await tick(0);
    expect(rank().querySelector('[data-q="q2"]')?.textContent).toContain(
      "No real problem, it is just not as good",
    );
  });

  it("leaves which-was-safer unset until the slider is used, then starts from the middle", async () => {
    mount();
    await tick(10);
    button("Got it", el.querySelector(".kr-intro")!).click();
    await tick(1300);
    const slider = () =>
      rank().querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider().hasAttribute("data-unset")).toBe(true);
    expect(slider().getAttribute("aria-valuetext")).toBe("Not answered");

    slider().dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(slider().hasAttribute("data-unset")).toBe(false);
    expect(slider().value).toBe("2");
    expect(slider().getAttribute("aria-valuetext")).toBe("Somewhat B");
    expect(document.activeElement).toBe(slider());
  });
});
