import { useEffect, useState, type RefObject } from "react";

/** A broken video can't hold the page back longer than this. */
const VIDEO_WAIT_MS = 5000;
const MAX_FRAMES = 60;

const frame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));

const loaded = (img: HTMLImageElement) =>
  img.complete
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });

const sized = (video: HTMLVideoElement) =>
  video.readyState >= HTMLMediaElement.HAVE_METADATA
    ? Promise.resolve()
    : Promise.race([
        new Promise<void>((resolve) => {
          video.addEventListener("loadedmetadata", () => resolve(), {
            once: true,
          });
          video.addEventListener("error", () => resolve(), { once: true });
        }),
        new Promise<void>((resolve) => setTimeout(resolve, VIDEO_WAIT_MS)),
      ]);

async function settle(pane: HTMLElement, chunks: readonly Promise<unknown>[]) {
  await Promise.allSettled(chunks);
  await document.fonts?.ready;
  // Parts that arrived with the chunks can bring images and videos of their own.
  await frame();
  await Promise.all([
    ...Array.from(pane.querySelectorAll("img"), loaded),
    ...Array.from(pane.querySelectorAll("video"), sized),
  ]);
  let height = -1;
  for (let count = 0; count < MAX_FRAMES; count++) {
    await frame();
    if (pane.scrollHeight === height) return;
    height = pane.scrollHeight;
  }
}

/**
 * Whether the page under `key` has laid out for good: its data `ready`, the
 * lazy parts it shows (`chunks`), the fonts, every image and video's size,
 * and then its height still on two frames running. Until then the page is
 * rendered in place but hidden, so its first paint is its final layout. A
 * page that settled stays settled.
 */
export function useSettleGate({
  pane,
  key,
  ready,
  chunks,
}: {
  pane: RefObject<HTMLElement | null>;
  key: string;
  ready: boolean;
  chunks: () => readonly Promise<unknown>[];
}): boolean {
  const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());
  const done = settled.has(key);
  useEffect(() => {
    const element = pane.current;
    if (done || !ready || !element) return;
    let cancelled = false;
    void settle(element, chunks()).then(() => {
      if (!cancelled) setSettled((keys) => new Set(keys).add(key));
    });
    return () => {
      cancelled = true;
    };
  }, [chunks, done, key, pane, ready]);
  return done;
}
