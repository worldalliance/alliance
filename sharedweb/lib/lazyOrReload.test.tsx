import { act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ChunkLoadError, holdChunkReloads, lazyOrReload } from "./lazyOrReload";

let loads = 0;

const failingChunk = () =>
  lazyOrReload<() => null>(() => {
    loads++;
    return Promise.reject(
      new Error("Failed to fetch dynamically imported module"),
    );
  });

const renderChunks = (count: number) => {
  const chunks = Array.from({ length: count }, failingChunk);
  render(
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <p>
          {error instanceof ChunkLoadError ? "Error boundary" : "Other error"}
        </p>
      )}
    >
      {chunks.map((Chunk, index) => (
        <Suspense key={index} fallback={<p>Loading</p>}>
          <Chunk />
        </Suspense>
      ))}
    </ErrorBoundary>,
  );
};

const settle = async (count = 1) => {
  await waitFor(() => expect(loads).toBe(count));
  await new Promise((resolve) => setTimeout(resolve, 20));
};

const reloadedBeforeThisPage = (millisecondsEarlier: number) =>
  sessionStorage.setItem(
    "lazy-chunk-reloaded-at",
    String(performance.timeOrigin - millisecondsEarlier),
  );

// React holds a Suspense boundary's next render for up to 300 ms, so an error
// boundary can appear that long after the failure.
const expectNoErrorBoundary = () =>
  expect(
    screen.findByText("Error boundary", {}, { timeout: 600 }),
  ).rejects.toThrow();

let reload: jest.SpyInstance;
const realSetTimeout = globalThis.setTimeout;
let reloadTimeouts: (() => void)[] = [];

beforeEach(() => {
  loads = 0;
  sessionStorage.clear();
  reload = jest.spyOn(window.location, "reload").mockImplementation(() => {});
  // Held rather than run, so none fires during a later test file.
  // lazyOrReload never clears its timers, so a held one needs no id.
  reloadTimeouts = [];
  globalThis.setTimeout = ((handler: () => void, delay?: number) => {
    if (delay !== 10_000) return realSetTimeout(handler, delay);
    reloadTimeouts.push(handler);
  }) as typeof setTimeout;
});

afterEach(() => {
  reload.mockRestore();
  globalThis.setTimeout = realSetTimeout;
});

it("reloads the page and keeps the fallback up when a chunk fails to load", async () => {
  renderChunks(1);
  await settle();

  expect(reload).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Loading")).toBeTruthy();
  await expectNoErrorBoundary();
});

it("reloads once when several chunks fail on the same page", async () => {
  renderChunks(2);
  await settle(2);

  expect(reload).toHaveBeenCalledTimes(1);
  await expectNoErrorBoundary();
});

it("shows the error boundary when the page a reload opened fails too", async () => {
  reloadedBeforeThisPage(100);
  renderChunks(1);

  expect(await screen.findByText("Error boundary")).toBeTruthy();
  expect(reload).not.toHaveBeenCalled();
  expect(reloadTimeouts).toHaveLength(0);
});

it("shows the error boundary when the visitor cancels the reload", async () => {
  renderChunks(1);
  await settle();
  expect(reload).toHaveBeenCalledTimes(1);

  act(() => reloadTimeouts.forEach((fire) => fire()));
  expect(await screen.findByText("Error boundary")).toBeTruthy();
});

it("shows the error boundary for a failure long into the page a reload opened", async () => {
  reloadedBeforeThisPage(100);
  const now = jest.spyOn(performance, "now").mockReturnValue(60_000);
  try {
    renderChunks(1);
    expect(await screen.findByText("Error boundary")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  } finally {
    now.mockRestore();
  }
});

it("shows the error boundary for a failure long after this page's reload was cancelled", async () => {
  sessionStorage.setItem(
    "lazy-chunk-reloaded-at",
    String(performance.timeOrigin + 1_000),
  );
  const now = jest.spyOn(performance, "now").mockReturnValue(16_000);
  try {
    renderChunks(1);
    expect(await screen.findByText("Error boundary")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  } finally {
    now.mockRestore();
  }
});

it("reloads again for a failure long after an earlier reload", async () => {
  reloadedBeforeThisPage(60_000);
  renderChunks(1);
  await settle();

  expect(reload).toHaveBeenCalledTimes(1);
});

it("shows the error boundary instead of reloading while a page holds unsaved work", async () => {
  const release = holdChunkReloads();
  try {
    renderChunks(1);
    expect(await screen.findByText("Error boundary")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  } finally {
    release();
  }
});

it("reloads again once the page's unsaved work is released", async () => {
  holdChunkReloads()();
  renderChunks(1);
  await settle();

  expect(reload).toHaveBeenCalledTimes(1);
});

it("stamps the reload on the page's clock, however far the wall clock drifts", async () => {
  const wallClock = jest
    .spyOn(Date, "now")
    .mockReturnValue(performance.timeOrigin - 60_000);
  try {
    renderChunks(1);
    await settle();
  } finally {
    wallClock.mockRestore();
  }

  expect(reload).toHaveBeenCalledTimes(1);
  expect(
    Number(sessionStorage.getItem("lazy-chunk-reloaded-at")),
  ).toBeGreaterThanOrEqual(performance.timeOrigin);
});
