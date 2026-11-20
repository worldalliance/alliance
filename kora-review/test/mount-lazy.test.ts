// @vitest-environment jsdom
import { describe, expect, it, vi } from "bun:test";
import type { KoraExport, KoraSaveResult } from "../src/index.js";
import {
  assignment,
  button,
  clone,
  el,
  expectValid,
  handle,
  hash,
  mount,
  pairs,
  saves,
  tick,
  useMountHarness,
} from "./mount-harness";

useMountHarness();

const given = (id: string) => {
  const transcript = pairs.find((p) => p.transcriptId === id)!;
  return { transcript, contentHash: hash(transcript) };
};
const heading = () => el.querySelector("h1")?.textContent ?? "";
const title = (id: string) =>
  pairs.find((p) => p.transcriptId === id)!.scenarioTitle;

describe("mountKoraReview: pairs given one at a time", () => {
  it("saves, then asks for the next pair, and finishes when there are no more", async () => {
    const next = vi
      .fn()
      .mockResolvedValueOnce(given("SAMPLE-04"))
      .mockResolvedValueOnce(null);
    const opts = mount({
      assignment: { ...assignment(["SAMPLE-03"]), size: 3 },
      next,
    });
    await tick(10);
    expect(el.querySelector(".fine")?.textContent).toBe("1 of 3.");

    button(/^Skip all conversations of /).click();
    await tick(50);
    expect(next).toHaveBeenCalledTimes(1);
    const saveOrder = (opts.save as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0]!;
    expect(saveOrder).toBeLessThan(next.mock.invocationCallOrder[0]!);
    expect(saves[0]!.results.map((r) => r.optedOut)).toEqual([true]);
    expect(heading()).toContain("fear and distress");
    expect(el.querySelector(".fine")?.textContent).toBe("2 of 3.");

    button(/^Skip all conversations of /).click();
    await tick(50);
    expect(next).toHaveBeenCalledTimes(2);
    expect(heading()).toBe("2 of 2 reviewed.");
    expect(opts.onComplete).toHaveBeenCalledTimes(1);
    await handle!.flush();
    const last = saves.at(-1)!;
    expectValid(last);
    expect(last.isDone).toBe(true);
    expect(last.results.map((r) => r.transcriptId)).toEqual([
      "SAMPLE-03",
      "SAMPLE-04",
    ]);
  });

  it("offers to try again when the next pair doesn't load", async () => {
    const next = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(given("SAMPLE-05"));
    mount({ assignment: { ...assignment(["SAMPLE-03"]), size: 2 }, next });
    await tick(10);
    button(/^Skip all conversations of /).click();
    await tick(50);
    expect(heading()).toBe("Couldn't load the next conversation");

    button("Try again").click();
    await tick(50);
    expect(next).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain(title("SAMPLE-05"));
  });

  it("drops a pair the host took out of the assignment and moves on", async () => {
    const save = vi
      .fn(async (e: KoraExport): Promise<KoraSaveResult | void> => {
        saves.push(clone(e));
      })
      .mockImplementationOnce(async (e: KoraExport) => {
        saves.push(clone(e));
        return { removed: ["SAMPLE-01"] };
      });
    mount({ assignment: assignment(["SAMPLE-01", "SAMPLE-02"]), save });
    await tick(10);
    expect(el.textContent).toContain(title("SAMPLE-01"));

    await tick(3000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain(title("SAMPLE-02"));
    expect(el.textContent).not.toContain(title("SAMPLE-01"));
    expect(el.textContent).toContain("1 of 2");

    await handle!.flush().catch(() => undefined);
    button("Got it").click();
    await tick(1300);
    el.querySelector<HTMLButtonElement>(".show-replies")?.click();
    await tick(10);
    await handle!.flush();
    const last = saves.at(-1)!;
    expect(last.results.map((r) => r.transcriptId)).toEqual(["SAMPLE-02"]);
  });
});
