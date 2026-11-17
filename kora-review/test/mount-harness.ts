import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { afterEach, beforeEach, expect, vi } from "bun:test";
import { createHash } from "node:crypto";
import samplePairs from "../samples/transcripts.json";
import {
  exportSchema,
  mountKoraReview,
  type KoraAssignment,
  type KoraExport,
  type KoraReviewHandle,
  type KoraReviewOptions,
  type KoraTranscript,
} from "../src/index.js";
import { advanceTimersByTimeAsync } from "./timers";

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validExport = ajv.compile(exportSchema);
export const expectValid = (e: KoraExport) =>
  expect(validExport(e), JSON.stringify(validExport.errors)).toBe(true);

export const pairs = samplePairs as KoraTranscript[];
export const hash = (t: KoraTranscript) =>
  "sha256:" + createHash("sha256").update(JSON.stringify(t)).digest("hex");
export const assignment = (
  ids: string[],
  batchId = "sample-assignment-1",
): KoraAssignment => ({
  batchId,
  size: ids.length,
  transcripts: ids.map((id) => {
    const t = pairs.find((p) => p.transcriptId === id)!;
    return { transcript: t, contentHash: hash(t) };
  }),
});
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export let el: HTMLElement;
export let handle: KoraReviewHandle | null = null;
export let saves: KoraExport[];
export function mount(over: Partial<KoraReviewOptions> = {}) {
  const opts: KoraReviewOptions = {
    reviewerId: "rv_8f3a2c71",
    assignment: assignment(["SAMPLE-01", "SAMPLE-02", "SAMPLE-03"]),
    savedExport: null,
    collectProfile: false,
    collectExitSurvey: false,
    save: vi.fn(async (e: KoraExport) => {
      saves.push(clone(e));
    }),
    next: vi.fn(async () => null),
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
export const rank = () => el.querySelector(".rank") as HTMLElement;
export const tick = (ms = 0) => advanceTimersByTimeAsync(ms);

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
