// @vitest-environment jsdom
import { describe, expect, it, vi } from "bun:test";
import { KoraSaveState, type KoraExport, type KoraNext } from "../src/index.js";
import {
  button,
  clone,
  el,
  expectValid,
  item,
  judgeScreen,
  mount,
  pick,
  readScreen,
  saves,
  text,
  tick,
  unmount,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

const session = (items = [item()]) => ({
  id: "session-1",
  number: 2,
  budgetUnits: 5,
  items,
});

describe("mountKoraReview: saving and resuming", () => {
  it("saves a valid export about two seconds after a change, and on nothing at all", async () => {
    mount();
    await tick(2100);
    expect(saves).toHaveLength(1);
    expectValid(saves[0]);
    expect(saves[0].place).toEqual({
      conversationId: "C-1",
      screen: "read",
    });

    pick("comp", 1);
    await tick(2100);
    expect(saves.at(-1)!.ratings[0].comprehensionAnswer).toBe(1);
  });

  it("reopens the Judge screen with the answers and highlights already given", async () => {
    mount();
    await tick(10);
    const reply = el.querySelector<HTMLElement>('.bubble[tabindex="0"]')!;
    reply.focus();
    reply.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    reply.dispatchEvent(
      new KeyboardEvent("keydown", { key: "+", bubbles: true }),
    );
    await tick(10);
    await readScreen();
    button("Not OK").click();
    await tick(2100);

    const saved = clone(saves.at(-1)!);
    expect(saved.place.screen).toBe("judge");
    unmount();
    document.body.innerHTML = "";

    const el2 = document.createElement("div");
    document.body.append(el2);
    mount({ savedExport: saved });
    await tick(10);

    expect(text()).toContain("Now judge the AI's answers");
    expect(el.querySelectorAll(".tk.pos").length).toBeGreaterThan(0);
    expect(text()).toContain("How serious would it be");
  });

  it("keeps the time already spent, so a soft block doesn't start again", async () => {
    const blocked = session([item({ position: 1, firstTimeOnRisk: true })]);
    mount({ session: { ...blocked, number: 1 } });
    await tick(30_000);
    pick("comp", 0);
    await tick(2100);
    const saved = clone(saves.at(-1)!);
    expect(saved.ratings[0].timeMsRead).toBeGreaterThanOrEqual(30_000);
    unmount();

    mount({ session: { ...blocked, number: 1 }, savedExport: saved });
    await tick(10);
    expect((button("Next") as HTMLButtonElement).disabled).toBe(true);
    await tick(13_000);
    expect((button("Next") as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the finished session again when the export says it is done", async () => {
    mount();
    await tick(10);
    await readScreen();
    await judgeScreen("OK");
    button("Skip this").click();
    await tick(2100);
    const saved = clone(saves.at(-1)!);
    expect(saved.isDone).toBe(true);
    unmount();

    const onComplete = vi.fn();
    mount({ savedExport: saved, onComplete });
    await tick(10);
    expect(text()).toContain("Thank you — that is a full session");
  });

  it("reports a failed save and clears the report when the next one lands", async () => {
    const onSaveStateChange = vi.fn();
    let fail = true;
    mount({
      save: vi.fn(async (e: KoraExport) => {
        if (fail) throw new Error("no");
        saves.push(clone(e));
      }),
      onSaveStateChange,
    });
    await tick(2100);
    expect(onSaveStateChange).toHaveBeenCalledWith(KoraSaveState.Failed);

    fail = false;
    pick("comp", 0);
    await tick(2100);
    expect(onSaveStateChange).toHaveBeenLastCalledWith(KoraSaveState.Saved);
  });

  it("drops a conversation the host withdraws", async () => {
    const nextItem = vi.fn(
      async (): Promise<KoraNext> => ({
        item: item({ conversationId: "C-2" }),
      }),
    );
    mount({
      save: vi.fn(async (e: KoraExport) => {
        saves.push(clone(e));
        return { removed: ["C-1"] };
      }),
      next: nextItem,
    });
    await tick(2100);
    expect(nextItem).toHaveBeenCalled();
    expect(saves.at(-1)!.ratings.every((r) => r.conversationId !== "C-1")).toBe(
      true,
    );
  });
});
