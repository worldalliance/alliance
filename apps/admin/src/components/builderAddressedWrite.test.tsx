import type { FormSchema } from "@alliance/common/forms/form-schema";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { FormBuilder } from "./FormBuilder";
import { OutputBuilder } from "./OutputBuilder";

const renderIn = (element: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>{element}</ToastProvider>
    </QueryClientProvider>,
  );

// `updateCurrent` is optional, so a builder that stops handing it out
// typechecks and puts the stale-form write back with nothing to say so.
afterEach(cleanup);

describe("OutputBuilder hands a display block the addressed write", () => {
  const schema: FormSchema = {
    pages: [{ id: "page-1", title: "One", fields: [] }],
    outputViews: [
      {
        type: "default",
        id: "view-1",
        blocks: [
          { type: "display", kind: "header", id: "block-1", text: "Hi" },
        ],
      },
    ],
  };

  it("edits through it rather than through the form it rendered with", () => {
    const addressed: string[] = [];
    const spread: FormSchema[] = [];
    renderIn(
      <OutputBuilder
        schema={schema}
        onSchemaChange={(next) => spread.push(next)}
        onUpdateBlockById={(blockId) => (addressed.push(blockId), true)}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter header text"), {
      target: { value: "Results" },
    });

    expect(addressed).toEqual(["block-1"]);
    expect(spread).toEqual([]);
  });
});

describe("FormBuilder hands a display block the addressed write", () => {
  const schema: FormSchema = {
    pages: [
      {
        id: "page-1",
        title: "One",
        fields: [{ type: "display", kind: "video", id: "block-1", src: "" }],
      },
      { id: "page-2", title: "Two", fields: [] },
    ],
    outputViews: [],
  };

  const openPage = (title: string) =>
    fireEvent.click(screen.getByRole("button", { name: title }));

  it("lands a video upload the admin paged away from", async () => {
    let finish: (body: unknown) => void = () => {};
    // A module mock would outlive this file, so the upload hangs on
    // `global.fetch` instead.
    const realFetch = global.fetch;
    global.fetch = (() =>
      new Promise((resolve) => {
        finish = (body) =>
          resolve({ ok: true, json: async () => body } as Response);
      })) as typeof fetch;

    try {
      const router = createMemoryRouter([
        {
          path: "/",
          element: <FormBuilder initialSchema={schema} setFormId={() => {}} />,
        },
      ]);
      renderIn(<RouterProvider router={router} />);

      await act(async () => {
        fireEvent.change(document.querySelector("input[type=file]")!, {
          target: { files: [new File(["x"], "playlist.m3u8")] },
        });
      });

      openPage("Two");
      fireEvent.change(screen.getByPlaceholderText("Page title"), {
        target: { value: "Renamed" },
      });

      await act(async () => {
        finish({ key: "videos/one", id: 7 });
      });

      expect(
        screen.getByPlaceholderText<HTMLInputElement>("Page title").value,
      ).toBe("Renamed");
      openPage("One");
      expect(screen.getByText("Manage video file")).toBeTruthy();
    } finally {
      global.fetch = realFetch;
    }
  });
});
