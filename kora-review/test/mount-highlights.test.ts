// @vitest-environment jsdom
import { describe, expect, it } from "bun:test";
import {
  button,
  el,
  expectValid,
  item,
  judgeScreen,
  mount,
  readScreen,
  saves,
  text,
  tick,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

const sheet = () => el.querySelector(".kr-sheet") as HTMLElement;
const reply = () => el.querySelector<HTMLElement>('.bubble[tabindex="0"]')!;
const press = (key: string, target: Element = reply()) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
const marks = () => el.querySelectorAll(".tk.pos, .tk.neg");
const latest = () => saves.at(-1)!.ratings[0];

async function highlightFirstWord(valence: "+" | "-" = "+") {
  reply().focus();
  press("ArrowRight");
  press(valence);
  await tick(10);
}

describe("mountKoraReview: highlights", () => {
  it("marks a span from the keyboard and keeps the sheet open for its reason", async () => {
    mount();
    await tick(10);
    await highlightFirstWord("-");

    expect(marks()).toHaveLength(1);
    expect(sheet().hidden).toBe(false);
    expect(sheet().textContent).toContain("Why? (optional)");
    expect(sheet().textContent).toContain("Unsafe advice");
    expect(sheet().textContent).not.toContain("Caring");

    button("Not for this age", sheet()).click();
    await tick(2100);
    expect(latest().highlights[0]).toMatchObject({
      valence: "dislike",
      reason: "not_for_this_age",
      turnIndex: 1,
    });
    expectValid(saves.at(-1)!);
  });

  it("offers the positive reasons on a like, and swaps them when the mark is flipped", async () => {
    mount();
    await tick(10);
    await highlightFirstWord("+");
    expect(sheet().textContent).toContain("Caring");
    expect(sheet().textContent).toContain("Points to an adult");

    button("Caring", sheet()).click();
    await tick(10);
    button(/Change to don't like/, sheet()).click();
    await tick(2100);

    expect(latest().highlights[0].valence).toBe("dislike");
    expect(latest().highlights[0]).not.toHaveProperty("reason");
    expect(sheet().textContent).toContain("Unsafe advice");
  });

  it("removes a highlight, and undoes the removal", async () => {
    mount();
    await tick(10);
    await highlightFirstWord("+");
    button("Remove", sheet()).click();
    await tick(10);
    expect(marks()).toHaveLength(0);

    press("z", el.ownerDocument.body);
    el.ownerDocument.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
    );
    await tick(10);
    expect(marks()).toHaveLength(1);
  });

  it("counts offsets in code points, so an emoji doesn't shift the span", async () => {
    mount({
      session: {
        id: "session-1",
        number: 2,
        budgetUnits: 5,
        items: [
          item({
            conversation: [
              { role: "child", text: "is it real" },
              { role: "ai", text: "👍👍 Almost certainly not." },
            ],
          }),
        ],
      },
    });
    await tick(10);
    reply().focus();
    press("ArrowRight");
    press("+");
    await tick(2100);

    const highlight = latest().highlights[0];
    expect(highlight.text).toBe("Almost");
    expect(highlight.charStart).toBe(3);
    expect(highlight.charEnd).toBe(9);
    expectValid(saves.at(-1)!);
  });

  it("shows the highlights on the Judge screen but does not let them be changed", async () => {
    mount();
    await tick(10);
    await highlightFirstWord("+");
    button("Caring", sheet()).click();
    await tick(10);
    await readScreen();

    expect(text()).toContain("Your highlights are marked");
    expect(marks().length).toBeGreaterThan(0);
    expect(el.querySelector('.bubble[tabindex="0"]')).toBe(null);

    const before = el.querySelectorAll(".tk.pos").length;
    el.ownerDocument.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await tick(10);
    expect(el.querySelectorAll(".tk.pos")).toHaveLength(before);
    expect(sheet().hidden).toBe(true);
  });

  it("carries the highlights into a finished rating", async () => {
    mount();
    await tick(10);
    await highlightFirstWord("-");
    await readScreen();
    await judgeScreen("Not OK");
    await tick(2100);

    const rating = saves.at(-1)!.ratings[0];
    expect(rating.status).toBe("done");
    expect(rating.highlights).toHaveLength(1);
    expect(rating.q3Severity).toBe(2);
    expectValid(saves.at(-1)!);
  });
});
