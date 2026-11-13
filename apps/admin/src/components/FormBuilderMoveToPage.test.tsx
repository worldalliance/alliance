import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  canvas,
  heading,
  outline,
  selectElement,
} from "../lib/testing/formCanvas";
import {
  renderDisplayOnlyBuilder,
  renderFormBuilder,
} from "../lib/testing/renderFormBuilder";

serveApi(routes({}, () => Response.json([])));

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "town", type: "input", kind: "text", label: "Town" },
        { id: "intro", type: "display", kind: "text", text: "Welcome" },
        { id: "pet", type: "input", kind: "text", label: "Pet" },
      ],
    },
    {
      id: "p2",
      title: "Two",
      fields: [{ id: "food", type: "input", kind: "text", label: "Food" }],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const entries = () =>
  outline()
    .getAllByRole("button", { name: /^(?!Contents of|Add page)/ })
    .map((button) => button.textContent);

it("moves the selected element to the end of the page picked, keeping it selected and in view", async () => {
  const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
  renderFormBuilder(schema);
  selectElement("Town");
  fireEvent.click(screen.getByRole("button", { name: "Move to page" }));
  expect(
    (await screen.findAllByRole("menuitem")).map((item) => item.textContent),
  ).toEqual(["2. Two"]);
  fireEvent.click(screen.getByRole("menuitem", { name: "2. Two" }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(entries()).toEqual([
    "One",
    "Two",
    "Text Field: Food",
    "Text Field: Town",
  ]);
  expect(heading()).toBe("Text Field: Town");
  expect(scroll.mock.contexts).toContain(
    canvas().getByRole("button", { name: "Select Text Field: Town" }),
  );
});

it("moves a selected range together", async () => {
  renderFormBuilder(schema);
  fireEvent.click(outline().getByRole("button", { name: "Text Field: Town" }));
  fireEvent.click(
    outline().getByRole("button", { name: "Text Block: Welcome" }),
    { shiftKey: true },
  );
  fireEvent.click(screen.getByRole("button", { name: "Move to page" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "2. Two" }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(entries()).toEqual([
    "One",
    "Two",
    "Text Field: Food",
    "Text Field: Town",
    "Text Block: Welcome",
  ]);
  expect(heading()).toBe("2 elements selected");
});

it("offers no move on a one-page form", () => {
  renderFormBuilder({ ...schema, pages: [schema.pages[0]!] });
  selectElement("Town");
  expect(screen.queryByRole("button", { name: "Move to page" })).toBeNull();
});

it("moves a shared-visibility group together, keeping it selected", async () => {
  const shown = {
    conditions: { c1: { kind: "hasValue", when: "town", hasValue: true } },
    formula: "c1",
  } as const;
  const [one, two] = schema.pages;
  renderFormBuilder({
    ...schema,
    pages: [
      {
        ...one!,
        fields: one!.fields.map((field) =>
          field.id === "town" ? field : { ...field, visibleIfFormula: shown },
        ),
      },
      two!,
    ],
  });
  fireEvent.click(
    outline().getByRole("button", { name: "Shared visibility · 2 elements" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Move to page" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "2. Two" }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(entries()).toEqual([
    "One",
    "Two",
    "Text Field: Food",
    "Shared visibility · 2 elements",
    "Text Block: Welcome",
    "Text Field: Pet",
  ]);
  expect(heading()).toBe("Shared visibility");
});

it("offers no move in a display-only builder", () => {
  renderDisplayOnlyBuilder({
    pages: [
      {
        id: "p1",
        fields: [{ id: "h", type: "display", kind: "header", text: "News" }],
      },
      { id: "p2", fields: [] },
    ],
    outputViews: [],
  });
  fireEvent.click(
    outline().getByRole("button", { name: "Header Block: News" }),
  );
  expect(heading()).toBe("Header Block: News");
  expect(screen.queryByRole("button", { name: "Move to page" })).toBeNull();
});
