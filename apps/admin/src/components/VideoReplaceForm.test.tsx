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
} from "@testing-library/react";
import { uploadSessionExpiredMessage } from "../lib/sessionExpired";
import VideoReplaceForm from "./VideoReplaceForm";

let answer: () => Response = () => Response.json({});
let requests = 0;
serveApi(
  routes({
    "POST /videos/:id/replace": () => {
      requests += 1;
      return answer();
    },
  }),
);
beforeEach(() => {
  requests = 0;
});
afterEach(cleanup);

const renderForm = () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.videoAdmin(7), { id: 7 });
  render(
    <ToastProvider>
      <VideoReplaceForm videoId={7} />
    </ToastProvider>,
    query,
  );
  return {
    detailInvalidated: () =>
      query.client.getQueryState(queryKeys.videoAdmin(7))?.isInvalidated,
  };
};

const choose = (names: string[]) =>
  fireEvent.change(document.querySelector("input[type=file]")!, {
    target: { files: names.map((name) => new File(["x"], name)) },
  });

const replace = async () => {
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Replace Video Content" }),
    );
  });
};

it("refreshes the video only once the server accepts the replacement", async () => {
  const { detailInvalidated } = renderForm();
  choose(["playlist.m3u8"]);

  answer = () =>
    Response.json(
      { statusCode: 401, message: "Unauthorized" },
      { status: 401 },
    );
  await replace();
  expect(screen.getByText(uploadSessionExpiredMessage)).toBeTruthy();

  answer = () =>
    Response.json({ message: "Video is processing" }, { status: 409 });
  await replace();
  expect(screen.getByText("Video is processing")).toBeTruthy();

  answer = () => Response.json({}, { status: 500 });
  await replace();
  expect(screen.getByText("Failed to replace video content")).toBeTruthy();
  expect(detailInvalidated()).toBe(false);

  answer = () => Response.json({ id: 7, key: "videos/7" });
  await replace();
  expect(screen.getByText("Video content replaced successfully")).toBeTruthy();
  expect(detailInvalidated()).toBe(true);
});

it("sends nothing without a playlist", async () => {
  renderForm();
  choose(["segment_000.ts"]);
  await replace();

  expect(
    screen.getByText("At least one .m3u8 playlist file is required"),
  ).toBeTruthy();
  expect(requests).toBe(0);
});
