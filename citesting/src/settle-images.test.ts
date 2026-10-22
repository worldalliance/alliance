import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { settleImages } from "./settle-images";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
});

afterAll(async () => {
  await browser?.close();
});

test("rejects an image that completed with a loading error", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<img src="data:image/png;base64,invalid">');
    const result = await settleImages(page);
    expect(result.ok).toBe(false);
  } finally {
    await page.close();
  }
});

test("loads and decodes a lazy image below the fold", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<div style="height:10000px"></div><img loading="lazy" decoding="async" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22%3E%3Crect width=%2210%22 height=%2210%22 fill=%22red%22/%3E%3C/svg%3E">',
    );
    expect((await settleImages(page)).ok).toBe(true);
    expect(
      await page
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBe(10);
  } finally {
    await page.close();
  }
});

test("waits for decoding after the image has finished loading", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22/%3E">',
    );
    await page.evaluate(() => {
      const img = document.querySelector("img");
      if (!img) throw new Error("Test image missing");
      const decode = img.decode.bind(img);
      img.decode = async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        await decode();
        img.dataset.decoded = "true";
      };
    });
    expect((await settleImages(page)).ok).toBe(true);
    expect(await page.locator("img").getAttribute("data-decoded")).toBe("true");
  } finally {
    await page.close();
  }
});
