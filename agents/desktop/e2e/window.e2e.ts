import {
  _electron as electron,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import type { NativeTheme } from "electron";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appArgs } from "./app-args";
import { crashRenderer } from "./crash-renderer";
import { heldPage } from "./held-page";

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

test("the built app opens a window whose title names Alliance agent", async () => {
  await expect(page).toHaveTitle(/Alliance agent$/);
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

const windowBackground = (target: ElectronApplication) =>
  target.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBackgroundColor().toUpperCase(),
  );

const pageBackground = async () => {
  const rgb = String(
    await page.evaluate("getComputedStyle(document.body).backgroundColor"),
  );
  const channels = rgb.match(/\d+/g) ?? [];
  const hex = channels.map((channel) =>
    Number(channel).toString(16).padStart(2, "0"),
  );
  return `#${hex.join("")}`.toUpperCase();
};

const followsTheme = async (
  theme: NativeTheme["themeSource"],
  colour: string,
) => {
  await app.evaluate(({ nativeTheme }, theme) => {
    nativeTheme.themeSource = theme;
  }, theme);
  // Playwright otherwise emulates light, whatever the app's theme.
  await page.emulateMedia({ colorScheme: null });
  await expect
    .poll(async () => [await windowBackground(app), await pageBackground()])
    .toEqual([colour, colour]);
};

test("the window's own background follows the page's light and dark colours", async () => {
  await followsTheme("dark", "#0D1117");
  await followsTheme("light", "#FFFFFF");
});

test("a window opened in dark mode starts with the dark background", async () => {
  const dark = test.info().outputPath("dark.cjs");
  await writeFile(
    dark,
    'require("electron").nativeTheme.themeSource = "dark";',
  );
  // -r runs before the app's code, so the window opens dark with no theme change after it to set its colour.
  const darkApp = await electron.launch({
    args: ["-r", dark, ...appArgs("dark")],
  });
  try {
    await darkApp.firstWindow();
    expect(await windowBackground(darkApp)).toBe("#0D1117");
  } finally {
    await darkApp.close();
  }
});

test("a button marked aria-disabled reads as inactive and shows no press", async () => {
  await page.evaluate(`{
    document.body.innerHTML =
      '<button>a</button><button aria-disabled="true">b</button><button class="primary">c</button><button class="primary" aria-disabled="true">d</button>';
    window.look = (name) => {
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent === name);
      const { opacity, backgroundColor, filter } = getComputedStyle(button);
      return { opacity, backgroundColor, filter };
    };
  }`);
  const look = (name: string) => page.evaluate(`look("${name}")`);
  const pressed = async (name: string) => {
    await page.getByRole("button", { name }).hover();
    await page.mouse.down();
    const looks = await look(name);
    await page.mouse.up();
    return looks;
  };
  for (const name of ["b", "d"]) {
    expect(await look(name)).toMatchObject({ opacity: "0.7" });
    expect(await pressed(name)).toEqual(await look(name));
  }
  for (const name of ["a", "c"]) {
    expect(await look(name)).toMatchObject({ opacity: "1" });
    expect(await pressed(name)).not.toEqual(await look(name));
  }
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

// Skipped at describe level, so on Linux beforeEach never launches an app only to quit it at once.
test.describe("on macOS", () => {
  test.skip(process.platform !== "darwin", "only macOS keeps the app open");

  test("reopening a closed window on macOS reloads a crashed page, showing it once reloaded", async () => {
    await crashRenderer(app);
    await app.evaluate(({ app, BrowserWindow }) => {
      const [window] = BrowserWindow.getAllWindows();
      if (!window) throw new Error("the app has no window");
      const calls: string[] = [];
      Object.assign(globalThis, { calls });
      window.webContents.once("did-finish-load", () => calls.push("loaded"));
      Object.assign(window, {
        show: () => calls.push("show"),
        focus: () => undefined,
      });
      window.close();
      app.emit("activate");
    });
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => {
          const contents = BrowserWindow.getAllWindows()[0]?.webContents;
          return contents && !contents.isCrashed() && !contents.isLoading();
        }),
      )
      .toBe(true);
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, "calls")))
      .toEqual(["loaded", "show"]);
  });

  test("closing a window on macOS while its crashed page reloads keeps it hidden once reloaded", async () => {
    await crashRenderer(app);
    await app.evaluate(({ app, BrowserWindow }) => {
      const [window] = BrowserWindow.getAllWindows();
      if (!window) throw new Error("the app has no window");
      const calls: string[] = [];
      Object.assign(globalThis, { calls });
      window.webContents.once("did-finish-load", () => calls.push("loaded"));
      Object.assign(window, {
        show: () => calls.push("show"),
        hide: () => calls.push("hide"),
        focus: () => undefined,
      });
      app.emit("activate");
      window.close();
    });
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, "calls")))
      .toEqual(["hide", "loaded"]);
    await app.evaluate(({ app }) => app.emit("activate"));
    expect(await app.evaluate(() => Reflect.get(globalThis, "calls"))).toEqual([
      "hide",
      "loaded",
      "show",
    ]);
  });

  test("closing a fullscreen window on macOS leaves fullscreen before it hides, unless it is reopened first", async () => {
    // A headless window can't go fullscreen, so its fullscreen state is stubbed, and it can paint late, so it is marked painted.
    const calls = await app.evaluate(({ app, BrowserWindow }) => {
      const [window] = BrowserWindow.getAllWindows();
      if (!window) throw new Error("the app has no window");
      window.emit("ready-to-show");
      const calls: string[] = [];
      Object.assign(window, {
        isFullScreen: () => true,
        setFullScreen: (fullScreen: boolean) =>
          calls.push(`setFullScreen ${fullScreen}`),
        show: () => calls.push("show"),
        hide: () => calls.push("hide"),
      });
      window.close();
      window.emit("leave-full-screen");
      window.close();
      app.emit("activate");
      window.emit("leave-full-screen");
      return calls;
    });
    expect(calls).toEqual([
      "setFullScreen false",
      "hide",
      "setFullScreen false",
      "show",
    ]);
  });
});

test("reopening the app before its window's first paint leaves showing it to that paint", async () => {
  const page = await heldPage();
  const unpainted = await electron.launch({
    args: appArgs("unpainted"),
    env: { ...process.env, ELECTRON_RENDERER_URL: page.url },
  });
  try {
    await page.requested;
    const calls = await unpainted.evaluate(({ app, BrowserWindow }) => {
      const [window] = BrowserWindow.getAllWindows();
      if (!window) throw new Error("the app has no window");
      const calls: string[] = [];
      Object.assign(window, {
        show: () => calls.push("show"),
        focus: () => calls.push("focus"),
      });
      app.emit("activate");
      return calls;
    });
    expect(calls).toEqual([]);
  } finally {
    page.release();
    await unpainted.close();
    page.close();
  }
});
