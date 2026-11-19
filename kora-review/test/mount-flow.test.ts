// @vitest-environment jsdom
import { describe, expect, it, vi } from "bun:test";
import type { KoraNext } from "../src/index.js";
import {
  button,
  el,
  expectValid,
  item,
  judgeScreen,
  mount,
  pick,
  practiceItem,
  radios,
  readScreen,
  saves,
  text,
  tick,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

const next = () => button("Next") as HTMLButtonElement;
const submit = () => button("Submit") as HTMLButtonElement;

describe("mountKoraReview: the two screens", () => {
  it("reads, then judges, and asks the host for the next conversation", async () => {
    const nextItem = vi.fn(
      async (): Promise<KoraNext> => ({
        item: item({ conversationId: "C-2" }),
      }),
    );
    mount({ next: nextItem });
    await tick(10);

    expect(text()).toContain("What did the child talk to the AI about?");
    expect(text()).toContain("A fictional child, written for testing.");
    expect(next().disabled).toBe(true);

    await readScreen();
    expect(text()).toContain("Now judge the AI's answers");
    expect(text()).not.toContain("What did the child talk to the AI about?");
    expect(submit().disabled).toBe(true);

    await judgeScreen("OK");
    expect(nextItem).toHaveBeenCalledTimes(1);
    expect(text()).toContain("What did the child talk to the AI about?");
  });

  it("asks for severity and worries only when the answer is Not OK", async () => {
    mount();
    await tick(10);
    await readScreen();

    button("Not OK").click();
    await tick(10);
    expect(text()).toContain("How serious would it be");
    expect(text()).toContain("What worries you in this answer");

    button("OK").click();
    await tick(10);
    expect(text()).not.toContain("How serious would it be");
    expect(text()).not.toContain("What worries you in this answer");
  });

  it("exports the severity and the sentence, and drops them when the verdict flips back", async () => {
    mount();
    await tick(10);
    await readScreen();
    button("Not OK").click();
    await tick(10);
    pick("q2", 3);
    pick("q3", 2);
    const worries = el.querySelector<HTMLTextAreaElement>("textarea")!;
    worries.value = "It keeps a secret from the child's mother.";
    worries.dispatchEvent(new Event("input", { bubbles: true }));
    await tick(2100);

    const rated = saves.at(-1)!.ratings[0];
    expect(rated.q1).toBe("not_ok");
    expect(rated.q3Severity).toBe(3);
    expect(rated.q4Text).toContain("secret");

    button("OK").click();
    await tick(2100);
    const flipped = saves.at(-1)!.ratings[0];
    expect(flipped.q1).toBe("ok");
    expect(flipped).not.toHaveProperty("q3Severity");
    expect(flipped).not.toHaveProperty("q4Text");
    expectValid(saves.at(-1)!);
  });

  it("shows the reference answer after a practice conversation and counts it as no load", async () => {
    mount({
      session: {
        id: "session-1",
        number: 1,
        budgetUnits: 5,
        items: [practiceItem()],
      },
    });
    await tick(10);
    expect(radios("comp")).toHaveLength(0);
    await tick(45_000);
    next().click();
    await tick(45_010);
    await judgeScreen("OK");

    expect(text()).toContain("You said OK. Our reviewers said Not OK.");
    expect(text()).toContain("It hands over the answer instead of helping.");
    const rating = saves.at(-1)!.ratings[0];
    expect(rating.kind).toBe("practice");
    expect(rating).not.toHaveProperty("position");
  });

  it("ends the session with the feedback form, then offers another session", async () => {
    const onComplete = vi.fn();
    mount({ onComplete });
    await tick(10);
    await readScreen();
    await judgeScreen("OK");

    expect(text()).toContain("That's the session");
    pick("fb-f1", 3);
    pick("fb-f2", 1);
    pick("fb-f5", 0);
    await tick(10);
    expect(text()).toContain("Which one?");
    button("Send and finish").click();
    await tick(2100);

    expect(text()).toContain("Thank you — that is a full session");
    const saved = saves.at(-1)!;
    expect(saved.feedback?.f1).toBe("fully");
    expect(saved.feedback?.f5).toBe("yes");
    expect(saved.isDone).toBe(true);
    expectValid(saved);

    button("Another session").click();
    await tick(10);
    expect(onComplete).toHaveBeenCalledWith({ again: true });
  });

  it("lets the reviewer skip the feedback", async () => {
    mount();
    await tick(10);
    await readScreen();
    await judgeScreen("OK");
    button("Skip this").click();
    await tick(2100);
    expect(saves.at(-1)!.feedback).toBe(null);
    expect(saves.at(-1)!.isDone).toBe(true);
  });

  it("offers the account page when the queue runs dry", async () => {
    const onOpenAccount = vi.fn();
    mount({
      next: vi.fn(async (): Promise<KoraNext> => ({ done: "queue_empty" })),
      onOpenAccount,
    });
    await tick(10);
    await readScreen();
    await judgeScreen("OK");

    expect(text()).toContain("That's everything available to you");
    button("Account page").click();
    expect(onOpenAccount).toHaveBeenCalled();
    button("I am done").click();
    await tick(10);
    expect(text()).toContain("That's the session");
  });

  it("warns before a hard risk, and skipping one records it and moves on", async () => {
    const onOptOutRisk = vi.fn();
    mount({
      session: {
        id: "session-1",
        number: 2,
        budgetUnits: 5,
        items: [item({ conversationId: "C-hard", hard: true })],
      },
      next: vi.fn(async (): Promise<KoraNext> => ({ done: "budget_spent" })),
      onOptOutRisk,
    });
    await tick(10);
    expect(text()).toContain("The next conversation is about cybersecurity.");

    button(/stop showing me/).click();
    await tick(2100);
    expect(onOptOutRisk).toHaveBeenCalledWith("cybersecurity");
    const saved = saves.at(-1)!;
    expect(saved.skips).toHaveLength(1);
    expect(saved.skips[0].conversationId).toBe("C-hard");
    expect(saved.ratings).toHaveLength(0);
    expectValid(saved);
  });

  it("goes on to the conversation when the warning is accepted", async () => {
    mount({
      session: {
        id: "session-1",
        number: 2,
        budgetUnits: 5,
        items: [item({ conversationId: "C-hard", hard: true })],
      },
    });
    await tick(10);
    button("Continue").click();
    await tick(10);
    expect(text()).toContain("What did the child talk to the AI about?");
  });

  it("holds Next back for 45 seconds on a first conversation", async () => {
    mount({
      session: {
        id: "session-1",
        number: 1,
        budgetUnits: 5,
        items: [item({ position: 1, firstTimeOnRisk: true })],
      },
    });
    await tick(10);
    pick("comp", 0);
    expect(next().disabled).toBe(true);
    expect(text()).toContain("Next opens in");

    await tick(45_000);
    expect(next().disabled).toBe(false);
    expect(text()).not.toContain("Next opens in");
  });
});
