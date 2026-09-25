import type { VideoListItemDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import VideoManagement from "./VideoManagement";

afterEach(cleanup);

const video = (id: number, originalFilename: string) =>
  ({
    id,
    key: `videos/${id}`,
    originalFilename,
    mime: "video/mp4",
    size: 2048,
    dateCreated: "2026-01-02T00:00:00.000Z",
    dateUpdated: "2026-01-02T00:00:00.000Z",
  }) satisfies VideoListItemDto;

let stored: VideoListItemDto[] = [];
let loadStatus = 200;
let loadGate = Promise.resolve();
let deleteStatus = 200;
const deleted: string[] = [];

serveApi(
  routes({
    "GET /videos": () => {
      if (loadStatus !== 200) {
        return Response.json({}, { status: loadStatus });
      }
      const snapshot = stored;
      return loadGate.then(() => Response.json({ videos: snapshot }));
    },
    "DELETE /videos/:id": ({ params }) => {
      if (deleteStatus === 404) {
        return Response.json(
          { message: "Not Found", statusCode: 404 },
          { status: 404 },
        );
      }
      if (deleteStatus !== 200) {
        return Response.json({}, { status: deleteStatus });
      }
      deleted.push(params.id);
      stored = stored.filter((v) => String(v.id) !== params.id);
      return Response.json({ success: true });
    },
  }),
);

beforeEach(() => {
  stored = [video(1, "intro.mp4"), video(2, "outro.mp4")];
  loadStatus = 200;
  loadGate = Promise.resolve();
  deleteStatus = 200;
  deleted.length = 0;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <VideoManagement />
      </MemoryRouter>
    </ToastProvider>,
    query,
  );

const deleteFirst = async () => {
  const [first] = await screen.findAllByRole("button", { name: "×" });
  fireEvent.click(first);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
};

it("lists the loaded videos", async () => {
  renderPage();
  expect(await screen.findByText("intro.mp4")).toBeTruthy();
  expect(screen.getByText("outro.mp4")).toBeTruthy();
});

it("removes a deleted video from the list", async () => {
  renderPage();
  await deleteFirst();

  await waitForElementToBeRemoved(() => screen.queryByText("intro.mp4"));
  expect(deleted).toEqual(["1"]);
});

it("keeps the video and says so when the delete fails", async () => {
  deleteStatus = 500;
  renderPage();
  await deleteFirst();

  expect(await screen.findByText("Failed to delete video")).toBeTruthy();
  expect(screen.getByText("intro.mp4")).toBeTruthy();
});

it("drops a video another admin already deleted", async () => {
  deleteStatus = 404;
  renderPage();
  await deleteFirst();

  await waitForElementToBeRemoved(() => screen.queryByText("intro.mp4"));
  expect(screen.queryByText("Not Found")).toBeNull();
});

it("keeps the delete when a refetch started before it lands after it", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("intro.mp4");

  let releaseLoad = () => {};
  loadGate = new Promise((resolve) => {
    releaseLoad = resolve;
  });
  const refetch = query.client.refetchQueries();
  await deleteFirst();

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseLoad();
    await refetch;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(deleted).toEqual(["1"]);
  expect(
    query.client
      .getQueryData<VideoListItemDto[]>(queryKeys.videosAdmin())
      ?.map((v) => v.id),
  ).toEqual([2]);
  expect(screen.queryByText("intro.mp4")).toBeNull();
});

it("says the videos failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Failed to load videos")).toBeTruthy();
  expect(screen.queryByText("No videos found.")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded videos beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("intro.mp4");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText("Failed to load videos")).toBeTruthy();
  expect(screen.getByText("intro.mp4")).toBeTruthy();
});
