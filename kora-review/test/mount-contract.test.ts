// @vitest-environment jsdom
import { describe, expect, it, vi } from "bun:test";
import { mountKoraReview, type KoraNext } from "../src/index.js";
import {
  button,
  clone,
  el,
  item,
  judgeScreen,
  mount,
  readScreen,
  saves,
  text,
  tick,
  unmount,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

const options = () => ({
  reviewerId: "rv_8f3a2c71",
  session: { id: "session-1", number: 1, budgetUnits: 5, items: [item()] },
  savedExport: null,
  save: async () => undefined,
  next: async (): Promise<KoraNext> => ({ done: "budget_spent" }),
  onOptOutRisk: () => undefined,
  onOpenAccount: () => undefined,
  onComplete: () => undefined,
  onSaveStateChange: () => undefined,
});
const mountWith = (over: Record<string, unknown>) =>
  mountKoraReview(el, { ...options(), ...over });

describe("mountKoraReview: the mount contract", () => {
  it("refuses a session the host got wrong, before anything is shown", () => {
    expect(() => mountWith({ reviewerId: "  " })).toThrow(/reviewerId/);
    expect(() =>
      mountWith({ session: { ...options().session, budgetUnits: 0 } }),
    ).toThrow(/budgetUnits/);
    expect(() =>
      mountWith({ session: { ...options().session, number: 0 } }),
    ).toThrow(/number/);
    expect(() => mountWith({ onOpenAccount: null })).toThrow(/onOpenAccount/);
  });

  it("refuses an item that isn't reviewable", () => {
    const bad = (over: Record<string, unknown>) => ({
      ...options().session,
      items: [{ ...item(), ...over }],
    });
    expect(() => mountWith({ session: bad({ riskId: "homework" }) })).toThrow(
      /not a known risk/,
    );
    expect(() => mountWith({ session: bad({ contentHash: "abc" }) })).toThrow(
      /sha256/,
    );
    expect(() =>
      mountWith({
        session: bad({ conversation: [{ role: "child", text: "hi" }] }),
      }),
    ).toThrow(/no ai turn/);
    expect(() =>
      mountWith({ session: bad({ kind: "practice", reference: null }) }),
    ).toThrow(/reference answer/);
    expect(() =>
      mountWith({
        session: {
          ...options().session,
          items: [
            item({ conversationId: "C-1" }),
            item({ conversationId: "C-1" }),
          ],
        },
      }),
    ).toThrow(/appears twice/);
  });

  it("refuses a saved export from another session or schema version", () => {
    expect(() =>
      mountWith({ savedExport: { schemaVersion: 2, sessionId: "session-1" } }),
    ).toThrow(/schemaVersion/);
    expect(() =>
      mountWith({
        savedExport: {
          schemaVersion: 3,
          sessionId: "another",
          reviewer: { id: "rv_8f3a2c71" },
          ratings: [],
        },
      }),
    ).toThrow(/does not match/);
    expect(() =>
      mountWith({
        savedExport: {
          schemaVersion: 3,
          sessionId: "session-1",
          reviewer: { id: "someone-else" },
          ratings: [],
        },
      }),
    ).toThrow(/different reviewerId/);
  });

  it("offers Try again when the host can't give the next conversation", async () => {
    let fail = true;
    const next = vi.fn(async (): Promise<KoraNext> => {
      if (fail) throw new Error("offline");
      return { done: "budget_spent" };
    });
    mount({ next });
    await tick(10);
    await readScreen();
    await judgeScreen("OK");

    expect(text()).toContain("Couldn't load the next conversation");
    expect(text()).toContain("Your answers so far are saved");

    fail = false;
    button("Try again").click();
    await tick(10);
    expect(text()).toContain("That's the session");
  });

  it("re-anchors highlights when the host changes a conversation's text", async () => {
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
    await tick(2100);
    const saved = clone(saves.at(-1)!);
    const span = saved.ratings[0].highlights[0].text;
    unmount();

    const edited = item({
      conversation: [
        { role: "child", text: "someone sent me a link for a free code" },
        {
          role: "ai",
          text: `Listen. ${"Almost certainly not real. Real codes never arrive that way."}`,
        },
        { role: "child", text: "ok i wont click it" },
      ],
      contentHash: `sha256:${"a".repeat(64)}`,
    });
    mount({
      session: { id: "session-1", number: 2, budgetUnits: 5, items: [edited] },
      savedExport: saved,
    });
    await tick(2100);

    const moved = saves.at(-1)!.ratings[0];
    expect(moved.stale).toEqual({ moved: 1, lost: 0 });
    expect(moved.highlights[0].text).toBe(span);
    expect(moved.highlights[0].charStart).toBe(8);
  });

  it("marks a highlight whose text has gone as orphaned", async () => {
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
    await tick(2100);
    const saved = clone(saves.at(-1)!);
    unmount();

    const rewritten = item({
      conversation: [
        { role: "child", text: "someone sent me a link for a free code" },
        { role: "ai", text: "Nothing of the sort survives here." },
      ],
      contentHash: `sha256:${"b".repeat(64)}`,
    });
    mount({
      session: {
        id: "session-1",
        number: 2,
        budgetUnits: 5,
        items: [rewritten],
      },
      savedExport: saved,
    });
    await tick(2100);

    const rating = saves.at(-1)!.ratings[0];
    expect(rating.stale).toEqual({ moved: 0, lost: 1 });
    expect(rating.highlights[0].orphaned).toBe(true);
    expect(el.querySelectorAll(".tk.pos")).toHaveLength(0);
  });
});
