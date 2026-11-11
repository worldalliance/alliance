import {
  _electron as electron,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appArgs } from "./app-args";

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await electron.launch({ args: appArgs() });
  page = await app.firstWindow();
  await expect(page.locator("#root main")).toBeAttached();
});

test.afterEach(async () => {
  await app.close();
});

// The page-side code is passed as strings: this tsconfig has no DOM lib.

test("the built app opens a window titled Alliance agent", async () => {
  await expect(page).toHaveTitle("Alliance agent");
});

test("the tests keep the window off screen", async () => {
  expect(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((window) => window.isVisible()),
    ),
  ).toEqual([false]);
});

test("the window refuses window.open", async () => {
  expect(await page.evaluate("window.open('https://example.com')")).toBeNull();
  expect(app.windows()).toHaveLength(1);
});

test("the window refuses in-page navigation", async () => {
  const url = page.url();
  const navigated = page.waitForEvent("framenavigated", { timeout: 1000 });
  await page.evaluate("location.href = 'https://example.com'");
  await expect(navigated).rejects.toThrow();
  expect(page.url()).toBe(url);
});

test("the window reloads, as Vite's full reload in dev does", async () => {
  await page.evaluate("window.marker = 1");
  await Promise.all([
    page.waitForEvent("load", { timeout: 1000 }),
    page.evaluate("location.reload()"),
  ]);
  expect(await page.evaluate("window.marker")).toBeUndefined();
});

test("the CSP blocks inline scripts", async () => {
  const violation = page.waitForEvent("console", {
    predicate: (message) => message.text().includes("Content Security Policy"),
    timeout: 1000,
  });
  await page.evaluate(`{
    const script = document.createElement("script");
    script.textContent = "document.body.dataset.inline = 'ran'";
    document.body.append(script);
  }`);
  expect(await page.evaluate("document.body.dataset.inline")).toBeUndefined();
  await violation;
});

test("the stylesheet loads, with its dark colours", async () => {
  const background = () =>
    page.evaluate("getComputedStyle(document.body).backgroundColor");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await background()).toBe("rgb(255, 255, 255)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background()).toBe("rgb(13, 17, 23)");
});

test("the page can't read local files", async () => {
  await expect(page.evaluate("fetch('file:///etc/hosts')")).rejects.toThrow();
});

function loadScript(src: string): Promise<unknown> {
  return page.evaluate(`new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = ${JSON.stringify(src)};
    script.onload = () => resolve("load");
    script.onerror = () => resolve("error");
    document.body.append(script);
  })`);
}

test("the page loads no script from outside the app", async () => {
  const script = test.info().outputPath("foreign.js");
  await writeFile(script, "");
  expect(await loadScript(pathToFileURL(script).toString())).toBe("error");
});

test("the app protocol serves nothing outside the renderer", async () => {
  expect(await loadScript("app://renderer/..%2Fmain%2Findex.js")).toBe("error");
});

test("the app protocol serves files whose names need percent-encoding", async () => {
  const script = path.join(import.meta.dirname, "../out/renderer/a é.js");
  await writeFile(script, "");
  try {
    expect(await loadScript("app://renderer/a%20%C3%A9.js")).toBe("load");
  } finally {
    await rm(script);
  }
});
