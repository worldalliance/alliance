import type { VideoListItemDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import MediaPage from "./MediaPage";

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

const renderPage = (
  query = queryWrapper(),
  url = "/content/media?tab=videos",
) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <MediaPage />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

const deleteFirst = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete: intro.mp4, video 1" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Delete video" }));
};

it("lists the loaded videos", async () => {
  renderPage();
  expect(await screen.findByText("intro.mp4")).toBeTruthy();
  expect(screen.getByText("outro.mp4")).toBeTruthy();
});

it("links each video to its record", async () => {
  renderPage();
  expect(
    (await screen.findByRole("link", { name: "intro.mp4" })).getAttribute(
      "href",
    ),
  ).toBe("/content/media/videos/1");
});

it("says what deleting a video leaves behind before deleting it", async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete: intro.mp4, video 1" }),
  );

  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText(/Delete the video “intro.mp4”\?/)).toBeTruthy();
  expect(
    dialog.getByText(
      "Video 1 disappears from the app, but its files stay in storage, so a direct link someone already copied keeps playing it.",
    ),
  ).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(deleted).toEqual([]);
  expect(screen.getByText("intro.mp4")).toBeTruthy();
});

it("filters the videos by filename, in the URL, and says when none match", async () => {
  renderPage(queryWrapper(), "/content/media?tab=videos&q=out");
  expect(await screen.findByText("outro.mp4")).toBeTruthy();
  expect(screen.queryByText("intro.mp4")).toBeNull();
  expect(screen.getByText("1 of 2 videos")).toBeTruthy();

  fireEvent.change(screen.getByRole("searchbox", { name: "Filter videos" }), {
    target: { value: "zzz" },
  });
  expect(await screen.findByText("No results")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(await screen.findByText("intro.mp4")).toBeTruthy();
});

it("says there are no videos yet when none exist", async () => {
  stored = [];
  renderPage();
  expect(await screen.findByText("No videos yet")).toBeTruthy();
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

  const dismiss = await screen.findByRole("button", { name: "Dismiss" });
  expect(screen.getAllByText("Couldn't delete video 1.")).toHaveLength(1);
  expect(screen.getByText("intro.mp4")).toBeTruthy();

  fireEvent.click(dismiss);
  expect(screen.queryByText("Couldn't delete video 1.")).toBeNull();
});

it("names the video and the server's reason when the delete is refused", async () => {
  deleteStatus = 401;
  renderPage();
  await deleteFirst();

  expect(
    await screen.findByText(
      `Couldn't delete video 1: ${sessionExpiredMessage}`,
    ),
  ).toBeTruthy();
});

it("moves focus to the next video's delete once a video is deleted", async () => {
  renderPage();
  await deleteFirst();

  await waitForElementToBeRemoved(() => screen.queryByText("intro.mp4"));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Delete: outro.mp4, video 2" }),
    ),
  );
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
  expect(await screen.findByText("Couldn't load videos")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.queryByText("No videos yet")).toBeNull();
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

  expect(await screen.findByText(/Couldn't refresh videos/)).toBeTruthy();
  expect(screen.getByText("intro.mp4")).toBeTruthy();
});
