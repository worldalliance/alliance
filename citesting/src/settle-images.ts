import type { Page } from "@playwright/test";
import { milliseconds } from "date-fns";
import { R, type Result } from "../../common/src/result";

// fullPage capture never scrolls, so images below the fold stay outside the
// lazy-loading threshold and would be captured blank.
export const settleImages = (page: Page): Promise<Result<void, Error>> =>
  R.fromPromiseFn(async () => {
    await page.evaluate(() => {
      for (const img of document.querySelectorAll<HTMLImageElement>(
        'img[loading="lazy"]',
      )) {
        img.loading = "eager";
      }
    });

    try {
      await page.waitForFunction(
        () => Array.from(document.images).every((img) => img.complete),
        undefined,
        { timeout: milliseconds({ seconds: 30 }) },
      );
    } catch {
      const pending = await page.evaluate(() =>
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => img.currentSrc || img.src),
      );
      throw new Error(
        `${page.url()} still had images loading after 30s: ${pending.join(", ")}`,
      );
    }
    const failed = await page.evaluate(async () => {
      const failures = await Promise.all(
        Array.from(document.images, async (img) => {
          try {
            await img.decode();
            return undefined;
          } catch {
            return img.currentSrc || img.src;
          }
        }),
      );
      return failures.filter((src) => src !== undefined);
    });
    if (failed.length) {
      throw new Error(
        `${page.url()} had images that failed to decode: ${failed.join(", ")}`,
      );
    }
  });
