// @vitest-environment jsdom
import { describe, expect, it } from "bun:test";
import {
  button,
  el,
  mount,
  pairs,
  tick,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

const chip = () => el.querySelector<HTMLButtonElement>(".cage-btn")!;
const menu = () => el.querySelector<HTMLElement>(".story-menu")!;
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

describe("mountKoraReview: the child's story and the scenario", () => {
  it("opens a menu from the age chip and shows both stories at the one picked", async () => {
    mount();
    await tick(10);
    button("Got it", el.querySelector(".kr-intro")!).click();
    await tick(10);
    expect(chip().textContent).toBe("Child, 11 years old");
    expect(chip().getAttribute("aria-haspopup")).toBe("menu");
    expect(menu().hidden).toBe(true);

    chip().click();
    expect(chip().getAttribute("aria-expanded")).toBe("true");
    const items = [...menu().querySelectorAll("[role=menuitem]")];
    expect(items.map((i) => i.textContent)).toEqual([
      "The child's story",
      "The scenario",
    ]);
    expect(document.activeElement).toBe(items[0]);
    key(items[0]!, "ArrowDown");
    expect(document.activeElement).toBe(items[1]);
    key(items[1]!, "Escape");
    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(chip());

    key(chip(), "ArrowUp");
    expect(document.activeElement).toBe(items[1]);
    (items[1] as HTMLButtonElement).click();
    expect(menu().hidden).toBe(true);
    const dlg = el.querySelector("dialog.story-dlg")!;
    const sample = pairs[0]!;
    expect([...dlg.querySelectorAll("h2")].map((h) => h.textContent)).toEqual([
      "The child's story",
      "The scenario",
    ]);
    expect(dlg.textContent).toContain(sample.childBackground!.slice(0, 40));
    expect(dlg.textContent).toContain(sample.scenario!.slice(0, 40));
    expect(document.activeElement?.textContent).toBe("The scenario");

    dlg.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click();
    dlg.dispatchEvent(new Event("close"));
    expect(el.querySelector("dialog.story-dlg")).toBeNull();
    expect(document.activeElement).toBe(chip());
  });
});
