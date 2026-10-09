import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  canvas,
  canvasButton,
  formJson,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);
let finishUpload: (response: Response) => void = () => {};
serveApi(
  routes(
    {
      "POST /videos/upload": () =>
        new Promise<Response>((resolve) => {
          finishUpload = resolve;
        }),
      "GET /user/list": () =>
        Response.json([
          makeUser({ id: 7, name: "Ana" }),
          makeUser({ id: 8, name: "Ben" }),
        ]),
    },
    () => Response.json([]),
  ),
);

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "Intro",
      fields: [
        {
          id: "note",
          type: "display",
          kind: "text",
          text: "Hello there",
          manualPerUser: true,
          manualUserContent: {
            "7": { text: "Dear Ana" },
            "8": { text: "Dear Ben" },
          },
        },
        { id: "town", type: "input", kind: "text", label: "Town" },
        {
          id: "clip",
          type: "display",
          kind: "video",
          src: "default.m3u8",
          manualPerUser: true,
          manualUserContent: {
            "7": { src: "ana.m3u8" },
            "8": { src: "ben.m3u8" },
          },
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const pickUser = async (name: string) =>
  fireEvent.click(await settings().findByRole("button", { name }));

/** A block's `key` in its default content and in each user's, as saved. */
const saved = (blockId: string, key: "text" | "src") => {
  const block = formSchema
    .parse(JSON.parse(formJson()))
    .pages[0]!.fields.find((field) => field.id === blockId);
  if (block?.type !== "display") throw new Error(`no block ${blockId}`);
  const read = (content: object) =>
    Object.entries(content).find(([name]) => name === key)?.[1];
  return {
    default: read(block),
    ...Object.fromEntries(
      Object.entries(block.manualUserContent ?? {}).map(([id, content]) => [
        id,
        read(content),
      ]),
    ),
  };
};
const savedText = () => saved("note", "text");

describe("personalized content on the canvas", () => {
  it("shows the default content until a user's is picked, then names them", async () => {
    renderFormBuilder(schema);
    selectElement("Hello there");
    expect(canvas().getByText("Hello there")).toBeTruthy();
    expect(canvas().queryByText(/^Editing content for/)).toBeNull();

    await pickUser("Ana");
    expect(canvas().getByText("Dear Ana")).toBeTruthy();
    expect(canvas().getByText("Editing content for Ana")).toBeTruthy();
    expect(settings().getByText("Editing content for Ana")).toBeTruthy();

    fireEvent.click(settings().getByRole("button", { name: "Edit default" }));
    expect(canvas().getByText("Hello there")).toBeTruthy();
    expect(canvas().queryByText(/^Editing content for/)).toBeNull();
  });

  it("edits the picked user's content in place, and undoes it alone", async () => {
    renderFormBuilder(schema);
    selectElement("Hello there");
    await pickUser("Ana");

    fireEvent.click(canvasButton("Edit text"));
    const input = canvas().getByRole<HTMLTextAreaElement>("textbox", {
      name: "Text",
    });
    expect(input.value).toBe("Dear Ana");
    fireEvent.change(input, { target: { value: "Dear Ana, welcome" } });
    await act(async () => {});
    fireEvent.keyDown(input, { key: "Escape" });

    await pickUser("Ben");
    expect(canvas().getByText("Dear Ben")).toBeTruthy();
    fireEvent.change(settings().getByPlaceholderText("Enter text content"), {
      target: { value: "Dear Ben, hi" },
    });
    expect(canvas().getByText("Dear Ben, hi")).toBeTruthy();
    expect(savedText()).toEqual({
      default: "Hello there",
      "7": "Dear Ana, welcome",
      "8": "Dear Ben, hi",
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(savedText()).toEqual({
      default: "Hello there",
      "7": "Dear Ana, welcome",
      "8": "Dear Ben",
    });
    expect(canvas().getByText("Dear Ben")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(savedText()).toEqual({
      default: "Hello there",
      "7": "Dear Ana",
      "8": "Dear Ben",
    });
  });

  it("returns to the default content once another element is selected", async () => {
    renderFormBuilder(schema);
    selectElement("Hello there");
    await pickUser("Ana");
    expect(canvas().getByText("Dear Ana")).toBeTruthy();

    selectElement("Town");
    expect(canvas().getByText("Hello there")).toBeTruthy();
    selectElement("Hello there");
    expect(canvas().getByText("Hello there")).toBeTruthy();
    expect(settings().queryByText("Editing content for Ana")).toBeNull();
  });

  it("returns to the default content once undo turns per-user content off", async () => {
    renderFormBuilder({
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "note",
              type: "display",
              kind: "text",
              text: "Hello there",
              manualUserContent: { "7": { text: "Dear Ana" } },
            },
          ],
        },
      ],
      outputViews: [],
    });
    selectElement("Hello there");
    fireEvent.click(settings().getByLabelText("Manual content per user"));
    await pickUser("Ana");
    expect(canvas().getByText("Dear Ana")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(canvas().getByText("Hello there")).toBeTruthy();
    expect(canvas().queryByText(/^Editing content for/)).toBeNull();
  });
});

describe("a delayed write to personalized content", () => {
  it("lands an upload on the block and user it was picked for", async () => {
    renderFormBuilder(schema);
    fireEvent.click(canvas().getByRole("button", { name: /^Select Video/ }));
    await pickUser("Ana");
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(["x"], "playlist.m3u8")] },
      });
    });

    await pickUser("Ben");
    selectElement("Town");
    await act(async () =>
      finishUpload(Response.json({ key: "new.m3u8", id: 3 })),
    );

    expect(saved("clip", "src")).toEqual({
      default: "default.m3u8",
      "7": "new.m3u8",
      "8": "ben.m3u8",
    });
  });
});
