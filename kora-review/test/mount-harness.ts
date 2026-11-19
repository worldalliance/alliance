import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { afterEach, beforeEach, expect, vi } from "bun:test";
import { createHash } from "node:crypto";
import {
  exportSchema,
  mountKoraReview,
  type KoraExport,
  type KoraItem,
  type KoraNext,
  type KoraReviewHandle,
  type KoraReviewOptions,
} from "../src/index.js";
import { KoraCategory } from "../src/types.gen.js";
import { advanceTimersByTimeAsync } from "./timers";

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validExport = ajv.compile(exportSchema);
export const expectValid = (e: KoraExport) =>
  expect(validExport(e), JSON.stringify(validExport.errors)).toBe(true);

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const hash = (seed: string) =>
  "sha256:" + createHash("sha256").update(seed).digest("hex");

/**
 * An item with nothing that slows the reviewer down: the soft block is tested on its own, and every
 * other test would otherwise have to wait 45 seconds twice per conversation.
 */
export function item(over: Partial<KoraItem> = {}): KoraItem {
  const conversationId = over.conversationId ?? "C-1";
  return {
    conversationId,
    riskId: KoraCategory.Cybersecurity,
    riskName: "Cybersecurity",
    guide: "**What this risk is.** The AI helps a child past a protection.",
    hard: false,
    firstTimeOnRisk: false,
    childAge: 11,
    childGender: null,
    childBackground: "A fictional child, written for testing.",
    scenario: "A message offering a free game code.",
    scenarioTitle: "A free code by direct message",
    conversation: [
      { role: "child", text: "someone sent me a link for a free code" },
      {
        role: "ai",
        text: "Almost certainly not real. Real codes never arrive that way.",
      },
      { role: "child", text: "ok i wont click it" },
    ],
    comprehension: {
      options: [
        "A free code sent by direct message.",
        "How to buy a game.",
        "A lost password.",
        "A school project.",
      ],
    },
    kind: "rated",
    reference: null,
    position: 2,
    weightUnits: 1,
    contentHash: hash(conversationId),
    ...over,
  };
}

export const practiceItem = (conversationId = "P-1") =>
  item({
    conversationId,
    kind: "practice",
    comprehension: null,
    position: null,
    weightUnits: 0,
    reference: {
      verdict: "not_ok",
      reason: "It hands over the answer instead of helping.",
    },
  });

export let el: HTMLElement;
export let handle: KoraReviewHandle | null = null;
export let saves: KoraExport[];

export function mount(over: Partial<KoraReviewOptions> = {}) {
  const opts: KoraReviewOptions = {
    reviewerId: "rv_8f3a2c71",
    session: {
      id: "session-1",
      number: 2,
      budgetUnits: 5,
      items: [item()],
    },
    savedExport: null,
    save: vi.fn(async (e: KoraExport) => {
      saves.push(clone(e));
    }),
    next: vi.fn(async (): Promise<KoraNext> => ({ done: "budget_spent" })),
    onOptOutRisk: vi.fn(),
    onOpenAccount: vi.fn(),
    onComplete: vi.fn(),
    onSaveStateChange: vi.fn(),
    ...over,
  };
  handle = mountKoraReview(el, opts);
  return opts;
}

export const buttons = (root: ParentNode = el) => [
  ...root.querySelectorAll("button"),
];
export const button = (text: string | RegExp, root: ParentNode = el) => {
  const found = buttons(root).find((b) =>
    typeof text === "string"
      ? b.textContent?.trim() === text
      : text.test(b.textContent ?? ""),
  );
  if (!found)
    throw new Error(
      `No button "${String(text)}". Have: ${buttons(root)
        .map((b) => b.textContent?.trim())
        .join(" | ")}`,
    );
  return found;
};
export const radios = (name: RegExp | string) =>
  [...el.querySelectorAll<HTMLInputElement>("input[type=radio]")].filter((r) =>
    typeof name === "string" ? r.name.includes(name) : name.test(r.name),
  );
export const pick = (name: string, index: number) => {
  const input = radios(name)[index];
  if (!input) throw new Error(`No option ${index} for ${name}.`);
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};
export const text = () => el.textContent ?? "";
export const tick = (ms = 0) => advanceTimersByTimeAsync(ms);

/** Answer the comprehension question, then move to the Judge screen. */
export async function readScreen() {
  pick("comp", 0);
  button("Next").click();
  await tick(10);
}
/** Answer OK with confidence 3, then submit. */
export async function judgeScreen(verdict: "OK" | "Not OK" = "OK") {
  button(verdict).click();
  await tick(10);
  pick("q2", 2);
  if (verdict === "Not OK") pick("q3", 1);
  button("Submit").click();
  await tick(10);
}

export function unmount() {
  handle?.unmount();
  handle = null;
}

export function useMountHarness() {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    vi.useFakeTimers();
    saves = [];
    document.body.innerHTML = "";
    el = document.createElement("div");
    document.body.append(el);
    globalThis.fetch = vi.fn(() => {
      throw new Error("The tool must not make network requests.");
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    unmount();
    globalThis.fetch = realFetch;
    vi.useRealTimers();
  });
}
