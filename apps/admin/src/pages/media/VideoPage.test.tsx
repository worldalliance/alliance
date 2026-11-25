import type { VideoDetailResponseDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import VideoPage from "./VideoPage";

let video: VideoDetailResponseDto = {
  id: 7,
  key: "videos/7",
  originalFilename: "intro.mp4",
  mime: "video/mp4",
  size: 2048,
  segments: [{ filename: "segment_000.ts", size: 1024, key: "videos/7/a" }],
  totalOutputSize: 1024,
  dateCreated: "2026-01-02T00:00:00.000Z",
  dateUpdated: "2026-01-02T00:00:00.000Z",
};
const original = video;

let loadStatus = 200;
const requestedIds: string[] = [];
const replacedWith: string[][] = [];

serveApi(
  routes({
    "GET /videos/:id/details": ({ params }) => {
      requestedIds.push(params.id);
      if (loadStatus !== 200) {
        return Response.json({}, { status: loadStatus });
      }
      return Response.json(video);
    },
    "POST /videos/:id/replace": async ({ request }) => {
      const files = (await request.formData()).getAll("files");
      replacedWith.push(files.map((f) => (f instanceof File ? f.name : "")));
      video = {
        ...video,
        segments: [{ filename: "segment_new.ts", size: 512, key: "b" }],
      };
      return Response.json({ id: video.id, key: video.key });
    },
  }),
);

beforeEach(() => {
  video = original;
  loadStatus = 200;
  requestedIds.length = 0;
  replacedWith.length = 0;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter initialEntries={["/content/media/videos/7"]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/content/media/videos/:videoId"
            element={<VideoPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

it("shows the loaded video", async () => {
  renderPage();
  expect(
    await screen.findByRole("heading", { level: 1, name: "intro.mp4" }),
  ).toBeTruthy();
  expect(screen.getByText("segment_000.ts")).toBeTruthy();
  expect(requestedIds).toEqual(["7"]);
});

it("shows the video's facts and the way back to the videos", async () => {
  renderPage();
  await screen.findByRole("heading", { level: 1, name: "intro.mp4" });

  expect(screen.getByText("Video ID 7")).toBeTruthy();
  const facts = screen.getByText("Original size").closest("dl");
  expect(facts?.textContent).toContain("Original size2.0 KB");
  expect(facts?.textContent).toContain("Output size1.0 KB");
  expect(facts?.textContent).toContain("MIME typevideo/mp4");
  expect(screen.getByText("1 file · 1.0 KB total")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Videos" }).getAttribute("href"),
  ).toBe("/content/media?tab=videos");
});

it("says the video is not found when the load is answered with 404", async () => {
  loadStatus = 404;
  renderPage();
  expect(await screen.findByText("Video not found")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "All videos" }).getAttribute("href"),
  ).toBe("/content/media?tab=videos");
});

it("says the video failed to load instead of not found", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Couldn't load this video")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("Video not found")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded video beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByRole("heading", { level: 1, name: "intro.mp4" });

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText(/Couldn't refresh this video/)).toBeTruthy();
  expect(
    screen.getByRole("heading", { level: 1, name: "intro.mp4" }),
  ).toBeTruthy();
});

const replaceWith = async (names: string[]) => {
  await screen.findByRole("heading", { level: 1, name: "intro.mp4" });
  fireEvent.change(screen.getByLabelText("Replacement files"), {
    target: { files: names.map((name) => new File(["x"], name)) },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Replace video content" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Replace content" }),
  );
};

it("shows the new segments after a replace", async () => {
  renderPage();
  await replaceWith(["output.m3u8", "segment_new.ts"]);

  expect(await screen.findByText("segment_new.ts")).toBeTruthy();
  expect(screen.queryByText("segment_000.ts")).toBeNull();
  expect(replacedWith).toEqual([["output.m3u8", "segment_new.ts"]]);
});

it("says a video with a malformed id is not found", async () => {
  loadStatus = 500;
  render(
    <MemoryRouter initialEntries={["/content/media/videos/abc"]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/content/media/videos/:videoId"
            element={<VideoPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  expect(await screen.findByText("Video not found")).toBeTruthy();
  expect(requestedIds).toEqual([]);
});
