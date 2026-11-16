// @vitest-environment jsdom
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { createHash } from "node:crypto";
import samplePairs from "../samples/transcripts.json";
import {
  exportSchema,
  KoraSaveState,
  mountKoraReview,
  type KoraAssignment,
  type KoraExport,
  type KoraReviewHandle,
  type KoraReviewOptions,
  type KoraTranscript,
} from "../src/index.js";
import { SAMPLE_EXPORT as sampleExport } from "../src/sample-export.js";
import { advanceTimersByTimeAsync } from "./timers";

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validExport = ajv.compile(exportSchema);
const expectValid = (e: KoraExport) =>
  expect(validExport(e), JSON.stringify(validExport.errors)).toBe(true);

const pairs = samplePairs as KoraTranscript[];
const hash = (t: KoraTranscript) =>
  "sha256:" + createHash("sha256").update(JSON.stringify(t)).digest("hex");
const assignment = (
  ids: string[],
  batchId = "sample-assignment-1",
): KoraAssignment => ({
  batchId,
  transcripts: ids.map((id) => {
    const t = pairs.find((p) => p.transcriptId === id)!;
    return { transcript: t, contentHash: hash(t) };
  }),
});
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

let el: HTMLElement;
let handle: KoraReviewHandle | null = null;
let saves: KoraExport[];
function mount(over: Partial<KoraReviewOptions> = {}) {
  const opts: KoraReviewOptions = {
    reviewerId: "rv_8f3a2c71",
    assignment: assignment(["SAMPLE-01", "SAMPLE-02", "SAMPLE-03"]),
    savedExport: null,
    collectProfile: false,
    collectExitSurvey: false,
    save: vi.fn(async (e: KoraExport) => {
      saves.push(clone(e));
    }),
    onComplete: vi.fn(),
    onSaveStateChange: vi.fn(),
    ...over,
  };
  handle = mountKoraReview(el, opts);
  return opts;
}
const buttons = (root: ParentNode = el) => [...root.querySelectorAll("button")];
const button = (text: string | RegExp, root: ParentNode = el) => {
  const b = buttons(root).find((x) =>
    typeof text === "string"
      ? x.textContent?.trim() === text
      : text.test(x.textContent ?? ""),
  );
  if (!b)
    throw new Error(
      `No button "${String(text)}". Have: ${buttons(root)
        .map((x) => x.textContent?.trim())
        .join(" | ")}`,
    );
  return b;
};
const sheet = () => el.querySelector(".kr-sheet") as HTMLElement;
const rank = () => el.querySelector(".rank") as HTMLElement;
const tick = (ms = 0) => advanceTimersByTimeAsync(ms);

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
  handle?.unmount();
  handle = null;
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

describe("mountKoraReview", () => {
  it("resumes a partly answered export exactly, and re-exports it unchanged", async () => {
    const saved = clone(sampleExport) as unknown as KoraExport;
    mount({ savedExport: saved });
    await tick(50);

    // Reopened on the same pair, with the half-answered ranking below it.
    expect(el.querySelector(".thread h1")?.textContent).toBe(
      "Essay due tomorrow",
    );
    expect(el.querySelector(".show-replies")).toBeNull();
    expect(el.querySelector<HTMLElement>(".pair")!.hidden).toBe(false);
    // Saved answers are restored; the comparison isn't answered yet, so it shows the pre-fill from the marks.
    const groups = [...rank().querySelectorAll(".seg")].map(
      (g) => g.querySelector('[aria-pressed="true"]')?.textContent,
    );
    expect(groups.slice(0, 2).sort()).toEqual(["Safe", "Unsafe"]);
    // The saved mark is drawn, with its note in the list.
    expect(el.querySelectorAll(".tk.neg").length).toBeGreaterThan(0);
    expect(el.querySelector(".ann-n")?.textContent).toContain(
      "Tells the child to hand in its work",
    );
    expect(el.textContent).toContain("1 of 3 reviewed");

    // Nothing is saved just for mounting.
    await tick(5000);
    expect(saves).toHaveLength(0);

    // Re-picking an answer the reviewer already gave is a change: the export round-trips.
    const safe = [
      ...rank().querySelectorAll('button[aria-pressed="true"]'),
    ].find((b) => b.textContent === "Safe") as HTMLButtonElement;
    safe.click();
    await handle!.flush();
    expect(saves).toHaveLength(1);
    const out = saves[0]!;
    expectValid(out);
    const strip = (e: KoraExport) => ({
      ...e,
      exportedAt: "",
      results: e.results.map((r) => ({ ...r, timeMs: 0 })),
    });
    expect(strip(out)).toEqual(strip(saved));
  });

  it("debounces saves to about two seconds after the last change, one in flight at a time", async () => {
    let release!: () => void;
    let inFlight = 0,
      max = 0;
    const opts = mount({
      save: vi.fn((e: KoraExport) => {
        saves.push(clone(e));
        inFlight++;
        max = Math.max(max, inFlight);
        return new Promise<void>((res) => {
          release = () => {
            inFlight--;
            res();
          };
        });
      }),
    });
    await tick(10);
    button("Got it").click();
    await tick(1300);
    expect(opts.save).not.toHaveBeenCalled();
    await tick(2000);
    expect(opts.save).toHaveBeenCalledTimes(1);
    expect(saves[0]!.currentTranscriptId).toBe("SAMPLE-01");

    // A change while that save hangs: no second save until it settles.
    button("Unsafe", rank()).click();
    await tick(10_000);
    expect(opts.save).toHaveBeenCalledTimes(1);
    release();
    await tick(0);
    expect(opts.save).toHaveBeenCalledTimes(2);
    release();
    await tick(0);
    expect(max).toBe(1);
    expectValid(saves[1]!);
    expect(
      Object.keys(saves[1]!.results[0]!).filter((k) => k.startsWith("q")),
    ).toHaveLength(1);
  });

  it("keeps working after a failed save, and reports Failed then Saved", async () => {
    let refuse = true;
    const opts = mount({
      save: vi.fn(async (e: KoraExport) => {
        if (refuse) throw new Error("refused");
        saves.push(clone(e));
      }),
    });
    await tick(10);
    button("Got it").click();
    await tick(3000);
    expect(opts.onSaveStateChange).toHaveBeenCalledWith(KoraSaveState.Failed);
    expect(el.textContent).not.toMatch(/fail|error|couldn't save/i); // the host shows the error, not the tool

    refuse = false;
    button("Unsafe", rank()).click();
    await tick(2100);
    expect(opts.onSaveStateChange).toHaveBeenLastCalledWith(
      KoraSaveState.Saved,
    );
    expect(opts.onSaveStateChange).toHaveBeenCalledTimes(2);
    expect(saves).toHaveLength(1);
    expect(saves[0]!.results[0]!.startedAt).not.toBeNull(); // nothing from before the failure was lost
    expectValid(saves[0]!);
  });

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
    expect(el.querySelector(".rhead")!.textContent).toContain(
      "1 of 2 reviewed",
    );
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

  it("types the child's message in on a new pair, then shows the replies on request", async () => {
    mount();
    await tick(10);
    expect(el.querySelector(".kr-intro")).not.toBeNull();
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
    await tick(1300 + 600);
    const typed = el.querySelectorAll(".opener .tw.on").length;
    expect(typed).toBeGreaterThan(0);
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
    expect(rank().textContent).toContain(
      "Your first negative mark was at this line:",
    );
    expect(rank().querySelector('label[for$="q3"]')?.textContent).toBe(
      "In your words, why was this response unsafe for the child?",
    );
    expect(rank().querySelector("textarea")!.value).toBe("");
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
      "Skipped this pair. 1 of 3 reviewed.",
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

  it("stores nothing in the browser and refuses an export from another reviewer", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mount();
    await tick(3000);
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
    handle!.unmount();
    handle = null;
    expect(el.children).toHaveLength(0);
    const other = clone(sampleExport) as unknown as KoraExport;
    other.reviewer.id = "someone-else";
    expect(() => mount({ savedExport: other })).toThrow(/different reviewerId/);
  });
});
