// @vitest-environment jsdom
import { describe, expect, it, vi } from "bun:test";
import { KoraCategory, KoraSaveState, type KoraExport } from "../src/index.js";
import { parseKoraExport } from "../src/parse.js";
import { SAMPLE_EXPORT as sampleExport } from "../src/sample-export.js";
import {
  button,
  clone,
  el,
  expectValid,
  handle,
  mount,
  rank,
  saves,
  tick,
  unmount,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

describe("mountKoraReview: saving and resuming", () => {
  it("resumes a partly answered export exactly, and re-exports it unchanged", async () => {
    const saved = clone(sampleExport) as unknown as KoraExport;
    mount({ savedExport: saved });
    await tick(50);

    // Reopened on the same pair, with the half-answered ranking below it.
    expect(el.querySelector(".thread h1")?.textContent).toBe(
      "Essay due tomorrow",
    );
    expect(el.querySelector(".show-replies")).toBeNull();
    expect(el.querySelector<HTMLElement>(".side")!.hidden).toBe(false);
    const pairId = el.querySelector<HTMLElement>(".pair-id-text")!;
    expect(pairId.hidden).toBe(true);
    button("#").click();
    expect([pairId.hidden, pairId.textContent]).toEqual([false, "SAMPLE-01"]);
    expect(
      rank().querySelector('.seg [aria-pressed="true"]')?.textContent,
    ).toBe("Unsafe");
    // The saved thumbs down comes back on its line.
    expect(el.querySelectorAll(".react-mark.r-down")).toHaveLength(1);
    expect(el.textContent).toContain("2 of 3");

    // Nothing is saved just for mounting.
    await tick(5000);
    expect(saves).toHaveLength(0);

    // Re-picking an answer the reviewer already gave is a change: the export round-trips.
    button("Unsafe", rank()).click();
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

  it("stores nothing in the browser and refuses an export from another reviewer", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mount();
    await tick(3000);
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
    unmount();
    expect(el.children).toHaveLength(0);
    const other = clone(sampleExport) as unknown as KoraExport;
    other.reviewer.id = "someone-else";
    expect(() => mount({ savedExport: other })).toThrow(/different reviewerId/);
  });

  it("repeats opt-outs from earlier assignments in the export", async () => {
    const saved = parseKoraExport(clone(sampleExport));
    mount({ savedExport: saved, optOutCategories: [KoraCategory.Violence] });
    await tick(50);
    button("Unsafe", rank()).click();
    await handle!.flush();
    expectValid(saves[0]!);
    expect(saves[0]!.optOutCategories).toEqual([KoraCategory.Violence]);
  });
});
