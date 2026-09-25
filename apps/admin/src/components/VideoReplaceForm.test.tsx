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
serveApi(routes({ "POST /videos/:id/replace": () => answer() }));
afterEach(cleanup);

const replace = async () => {
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Replace Video Content" }),
    );
  });
};

it("completes only once the server accepts the replacement", async () => {
  const onComplete = jest.fn();
  render(
    <ToastProvider>
      <VideoReplaceForm videoId={7} onComplete={onComplete} />
    </ToastProvider>,
  );
  fireEvent.change(document.querySelector("input[type=file]")!, {
    target: { files: [new File(["x"], "playlist.m3u8")] },
  });

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
  expect(onComplete).not.toHaveBeenCalled();

  answer = () => Response.json({ id: 7, key: "videos/7" });
  await replace();
  expect(screen.getByText("Video content replaced successfully")).toBeTruthy();
  expect(onComplete).toHaveBeenCalledTimes(1);
});
