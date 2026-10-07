import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { client } from "@alliance/shared/client/client.gen";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { z } from "zod";
import { selectElement } from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);

const equalsAlpha: VisibleIfFormula = {
  conditions: { c1: { kind: "equals", when: "ctrl", equals: "alpha" } },
  formula: "c1",
};

const items: PageItem[] = [
  {
    id: "before",
    type: "input",
    kind: "text",
    label: "Before",
    visibleIfFormula: equalsAlpha,
  },
  {
    id: "ctrl",
    type: "input",
    kind: "radio",
    label: "Ctrl",
    options: [
      { label: "Alpha", value: "alpha" },
      { label: "Beta", value: "beta" },
    ],
  },
  {
    id: "after",
    type: "input",
    kind: "text",
    label: "After",
    visibleIfFormula: equalsAlpha,
  },
];

const schemaWith = (fields: PageItem[]): FormSchema => ({
  pages: [{ id: "p1", fields }],
  outputViews: [],
  aggregateViews: [],
  variables: [],
});

const savedElement = z.object({
  id: z.string(),
  visibleIfFormula: z
    .object({
      conditions: z.record(z.string(), z.object({ equals: z.unknown() })),
    })
    .optional(),
});

const savedPage = z.object({
  schema: z.object({
    pages: z.array(
      z.object({
        fields: z.array(savedElement),
      }),
    ),
  }),
});

describe("FormBuilder option value rename", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  it("rewrites conditions above and below a controller", async () => {
    const schema = schemaWith(items);
    const bodies: unknown[] = [];
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        if (request.method !== "GET") {
          bodies.push(await request.json());
          return Response.json({ id: 1, schema, formSnapshotId: 2 });
        }
        const path = new URL(request.url).pathname;
        return path === "/tasks/listForms" || /validator/i.test(path)
          ? Response.json([])
          : Response.json({ id: 1, schema, formSnapshotId: 1 });
      },
    });
    renderFormBuilder(schema, 1);
    selectElement("Ctrl");

    const valueInput = screen
      .getAllByPlaceholderText<HTMLInputElement>("Value")
      .find((input) => input.value === "alpha");
    fireEvent.change(valueInput!, { target: { value: "zeta" } });
    fireEvent.click(screen.getByText("Save Form"));
    await waitFor(() => expect(bodies).toHaveLength(1));

    const saved = savedPage.parse(bodies[0]).schema.pages[0]!.fields;
    const equalsOf = (id: string) =>
      saved.find((f) => f.id === id)?.visibleIfFormula?.conditions.c1?.equals;
    expect(equalsOf("before")).toBe("zeta");
    expect(equalsOf("after")).toBe("zeta");
  });
});
