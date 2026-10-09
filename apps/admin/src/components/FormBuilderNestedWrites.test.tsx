import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { selectElement, settings } from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);
let finishUpload = () => {};
serveApi(
  routes(
    {
      "POST /videos/upload": () =>
        new Promise<Response>((resolve) => {
          finishUpload = () => resolve(Response.json({ key: "v.m3u8", id: 7 }));
        }),
    },
    () => Response.json([]),
  ),
);

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "town", type: "input", kind: "text", label: "Town" },
        {
          id: "faq",
          type: "display",
          kind: "accordion",
          sections: [
            {
              id: "s1",
              title: "Shipping",
              blocks: [{ id: "v1", type: "display", kind: "video", src: "" }],
            },
          ],
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const labelInput = () =>
  settings().getByPlaceholderText<HTMLInputElement>("Enter field label");

const startUpload = async () => {
  renderFormBuilder(schema);
  selectElement("Accordion Block: Shipping");
  fireEvent.click(settings().getByRole("button", { name: /^Video/ }));
  const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
  await act(async () => {
    fireEvent.change(input, {
      target: { files: [new File(["x"], "playlist.m3u8")] },
    });
  });
};

const landUpload = () =>
  act(async () => {
    finishUpload();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

it("keeps an edit made elsewhere while a nested block's upload is in flight", async () => {
  await startUpload();
  selectElement("Town");
  fireEvent.change(labelInput(), { target: { value: "City" } });
  await landUpload();
  selectElement("City");
  expect(labelInput().value).toBe("City");
});

it("keeps an edit to the nested block itself while its upload is in flight", async () => {
  await startUpload();
  fireEvent.change(settings().getByPlaceholderText("Add an optional caption"), {
    target: { value: "Welcome" },
  });
  await landUpload();
  expect(
    settings().getByPlaceholderText<HTMLInputElement>("Add an optional caption")
      .value,
  ).toBe("Welcome");
  expect(
    settings().getByRole("link", { name: "Manage video file" }),
  ).toBeTruthy();
});

it.each([
  ["with an id", "faq"],
  ["without one", undefined],
])("edits a nested block's settings in an accordion %s", (_, id) => {
  renderFormBuilder({
    ...schema,
    pages: [
      {
        id: "p1",
        fields: [
          {
            id,
            type: "display",
            kind: "accordion",
            sections: [
              {
                id: "s1",
                title: "Shipping",
                blocks: [
                  { id: "a", type: "display", kind: "spacer" },
                  { id: "b", type: "display", kind: "text", text: "Second" },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  selectElement("Accordion Block: Shipping");
  fireEvent.click(settings().getByRole("button", { name: /^Spacer/ }));
  fireEvent.change(settings().getByRole("combobox"), {
    target: { value: "xl" },
  });
  expect(settings().getByRole<HTMLSelectElement>("combobox").value).toBe("xl");
  selectElement("Accordion Block: Shipping");
  expect(
    settings().getByRole("button", { name: /^Text Block: Second/ }),
  ).toBeTruthy();
});
