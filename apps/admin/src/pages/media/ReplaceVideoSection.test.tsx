import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { escapeRegExp } from "es-toolkit";
import { MemoryRouter } from "react-router";
import { uploadSessionExpiredMessage } from "../../lib/sessionExpired";
import { SAVE_FAILED_FALLBACK } from "../../ui/templates/Form";
import { ToastProvider } from "../../ui/ToastProvider";
import { ReplaceVideoSection } from "./ReplaceVideoSection";

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

const renderForm = () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.videoAdmin(7), { id: 7 });
  render(
    <MemoryRouter>
      <ToastProvider>
        <ReplaceVideoSection videoId={7} filename="intro.mp4" />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
  return {
    detailInvalidated: () =>
      query.client.getQueryState(queryKeys.videoAdmin(7))?.isInvalidated,
  };
};

const choose = (names: string[]) =>
  fireEvent.change(screen.getByLabelText("Replacement files"), {
    target: { files: names.map((name) => new File(["x"], name)) },
  });

const press = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Replace video content" }),
  );

const replace = async () => {
  press();
  const confirm = await screen.findByRole("button", {
    name: "Replace content",
  });
  await act(async () => {
    fireEvent.click(confirm);
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
};

const shown = (text: string) =>
  screen.findByText(new RegExp(escapeRegExp(text)));

it("refreshes the video only once the server accepts the replacement", async () => {
  const { detailInvalidated } = renderForm();
  choose(["playlist.m3u8"]);

  answer = () =>
    Response.json(
      { statusCode: 401, message: "Unauthorized" },
      { status: 401 },
    );
  await replace();
  expect(await shown(uploadSessionExpiredMessage)).toBeTruthy();

  answer = () =>
    Response.json({ message: "Video is processing" }, { status: 409 });
  await replace();
  expect(await shown("Video is processing")).toBeTruthy();

  answer = () => Response.json({}, { status: 500 });
  await replace();
  expect(await shown(SAVE_FAILED_FALLBACK)).toBeTruthy();
  expect(detailInvalidated()).toBe(false);

  answer = () => Response.json({ id: 7, key: "videos/7" });
  await replace();
  expect(await screen.findByText("Video content replaced")).toBeTruthy();
  expect(detailInvalidated()).toBe(true);
});

it("sends nothing without a playlist", async () => {
  renderForm();
  choose(["segment_000.ts"]);
  press();

  expect(
    await screen.findByText("At least one .m3u8 playlist file is required"),
  ).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(requests).toBe(0);
});

it("asks for files when none are chosen", async () => {
  renderForm();
  press();

  expect(
    await screen.findByText("Choose the playlist and its segment files"),
  ).toBeTruthy();
  expect(requests).toBe(0);
});

it("says what replacing does and sends nothing when declined", async () => {
  renderForm();
  choose(["playlist.m3u8", "segment_000.ts"]);
  press();

  const dialog = within(await screen.findByRole("dialog"));
  expect(
    dialog.getByText(
      "Everyone who plays video 7 gets the 2 files you chose. Its current files are deleted and can't be restored.",
    ),
  ).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(requests).toBe(0);
  expect(screen.getByText("2 files selected")).toBeTruthy();
});
