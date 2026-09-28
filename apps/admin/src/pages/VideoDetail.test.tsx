import type { VideoDetailResponseDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import VideoDetail from "./VideoDetail";

afterEach(cleanup);

const video = {
  id: 7,
  key: "videos/7",
  originalFilename: "intro.mp4",
  mime: "video/mp4",
  size: 2048,
  segments: [{ filename: "segment_000.ts", size: 1024, key: "videos/7/a" }],
  totalOutputSize: 1024,
  dateCreated: "2026-01-02T00:00:00.000Z",
  dateUpdated: "2026-01-02T00:00:00.000Z",
} satisfies VideoDetailResponseDto;

let loadStatus = 200;
const requestedIds: string[] = [];

serveApi(
  routes({
    "GET /videos/:id/details": ({ params }) => {
      requestedIds.push(params.id);
      if (loadStatus !== 200) {
        return Response.json({}, { status: loadStatus });
      }
      return Response.json(video);
    },
  }),
);

beforeEach(() => {
  loadStatus = 200;
  requestedIds.length = 0;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/videos/7"]}>
        <Routes>
          <Route path="/videos/:videoId" element={<VideoDetail />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
    query,
  );

it("shows the loaded video", async () => {
  renderPage();
  expect(await screen.findByText("intro.mp4")).toBeTruthy();
  expect(screen.getByText("segment_000.ts")).toBeTruthy();
  expect(requestedIds).toEqual(["7"]);
});

it("says the video is not found when the load is answered with 404", async () => {
  loadStatus = 404;
  renderPage();
  expect(await screen.findByText("Video not found.")).toBeTruthy();
});

it("says the video failed to load instead of not found", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Failed to load video details")).toBeTruthy();
  expect(screen.queryByText("Video not found.")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded video beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("intro.mp4");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText("Failed to load video details")).toBeTruthy();
  expect(screen.getByText("intro.mp4")).toBeTruthy();
});
