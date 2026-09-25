import type { VideoBlock } from "@alliance/common/forms/display-blocks";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { uploadSessionExpiredMessage } from "../../lib/sessionExpired";
import { EditableVideoBlock } from "./EditableVideoBlock";

let answer: () => Response = () => Response.json({});
serveApi(routes({ "POST /videos/upload": () => answer() }));
afterEach(cleanup);

const block: VideoBlock = {
  type: "display",
  kind: "video",
  id: "block-1",
  src: "",
};

const upload = async (
  beforePick: (input: HTMLInputElement) => void = () => {},
) => {
  const onUpdate = jest.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <EditableVideoBlock
          block={block}
          onUpdate={onUpdate}
          onRemove={() => {}}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
  const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
  beforePick(input);
  await act(async () => {
    fireEvent.change(input, {
      target: { files: [new File(["x"], "playlist.m3u8")] },
    });
  });
  return onUpdate;
};

describe("EditableVideoBlock upload failure", () => {
  it("shows the server's message", async () => {
    answer = () =>
      Response.json({ message: "Playlist is malformed" }, { status: 400 });
    const onUpdate = await upload();
    expect(screen.getByText("Playlist is malformed")).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("names the status when the body carries no message", async () => {
    answer = () => new Response("<html>Too large</html>", { status: 413 });
    await upload();
    expect(screen.getByText("Upload failed with status 413")).toBeTruthy();
  });

  it("asks for the upload again when the session had expired", async () => {
    answer = () =>
      Response.json(
        { statusCode: 401, message: "Unauthorized" },
        { status: 401 },
      );
    await upload();
    expect(screen.getByText(uploadSessionExpiredMessage)).toBeTruthy();
  });

  it("clears the picked files so the same ones can be picked again", async () => {
    answer = () =>
      Response.json(
        { statusCode: 401, message: "Unauthorized" },
        { status: 401 },
      );
    const assigned: string[] = [];
    await upload((input) =>
      Object.defineProperty(input, "value", {
        get: () => "",
        set: (value: string) => assigned.push(value),
      }),
    );
    expect(assigned).toEqual([""]);
  });
});
