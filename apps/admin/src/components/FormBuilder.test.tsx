import type { FormSchema } from "@alliance/common/forms/form-schema";
import { client } from "@alliance/shared/client/client.gen";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { FormBuilder } from "./FormBuilder";

afterEach(cleanup);

const readsTown = {
  inputs: { input1: { kind: "field", fieldId: "town" } },
  formula: "input1",
} as const;

const mine: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "town", type: "input", kind: "text", label: "Town" }],
    },
  ],
  outputViews: [],
  aggregateViews: [],
  variables: [
    { name: "a", ...readsTown },
    { name: "b", ...readsTown },
  ],
};

function renderBuilder(initialSchema: FormSchema = mine) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <FormBuilder
          formId={1}
          initialSchema={initialSchema}
          setFormId={() => {}}
        />
      ),
    },
  ]);
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </SiteOriginLinkProvider>,
  );
}

describe("FormBuilder save conflict", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  beforeEach(() => {
    const theirs = { ...mine, variables: [{ name: "b", ...readsTown }] };
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        if (request.method !== "GET")
          return new Response(null, { status: 409 });
        return new URL(request.url).pathname === "/tasks/listForms"
          ? Response.json([])
          : Response.json({ id: 1, schema: theirs, formSnapshotId: 2 });
      },
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  it.each(["Take theirs", "Merge changes"])(
    "%s clears every variable's sample answers",
    async (resolve) => {
      renderBuilder();
      fireEvent.change(screen.getByPlaceholderText("Page title"), {
        target: { value: "Where" },
      });
      fireEvent.click(screen.getByText("Variables"));
      const [first, second] = screen.getAllByLabelText<HTMLInputElement>(
        "Sample answer for input1",
      );
      fireEvent.change(first!, { target: { value: "Oslo" } });
      fireEvent.change(second!, { target: { value: "Lima" } });
      fireEvent.click(screen.getByText("Save Form"));
      fireEvent.click(await screen.findByText(resolve));

      await waitFor(() =>
        expect(
          screen.getAllByLabelText<HTMLInputElement>(
            "Sample answer for input1",
          ),
        ).toHaveLength(1),
      );
      expect(
        screen.getByLabelText<HTMLInputElement>("Sample answer for input1")
          .value,
      ).toBe("");
    },
  );
});

describe("FormBuilder save conflict with an options formula", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  it("Take theirs drops the formula editor's undo", async () => {
    const withFormula: FormSchema = {
      ...mine,
      variables: undefined,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "pick",
              type: "input",
              kind: "select",
              label: "Pick",
              options: [],
              optionsFormula: { inputs: {}, formula: "[]" },
            },
          ],
        },
      ],
    };
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        if (request.method !== "GET")
          return new Response(null, { status: 409 });
        return new URL(request.url).pathname === "/tasks/listForms"
          ? Response.json([])
          : Response.json({ id: 1, schema: withFormula, formSnapshotId: 2 });
      },
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);
    renderBuilder(withFormula);

    fireEvent.click(
      screen.getByRole("button", { name: "What you can write here" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "[{ label: 'Other', value: 'other' }]",
      }),
    );
    expect(screen.getByText(/Undo, back to/)).toBeTruthy();
    fireEvent.click(screen.getByText("Save Form"));
    fireEvent.click(await screen.findByText("Take theirs"));

    await waitFor(() => expect(screen.queryByText(/Undo, back to/)).toBeNull());
  });
});

describe("FormBuilder save while a source form loads", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  const stallSourceForms = (): string[] => {
    const writes: string[] = [];
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        const { pathname } = new URL(request.url);
        if (request.method !== "GET") {
          writes.push(pathname);
          return Response.json({});
        }
        if (pathname === "/tasks/listForms") return Response.json([]);
        return new Promise<Response>(() => {});
      },
    });
    return writes;
  };

  it("waits for the source form's questions instead of calling it missing", async () => {
    const writes = stallSourceForms();
    renderBuilder({
      ...mine,
      variables: [
        {
          name: "scores",
          inputs: {
            input1: { kind: "sourceField", sourceFormId: 9, fieldId: "score" },
          },
          formula: "input1.length",
        },
      ],
    });
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });
    fireEvent.click(screen.getByText("Save Form"));

    expect(
      await screen.findByText(
        "Still loading the questions of forms your formulas read. Try again in a moment.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/doesn't exist/)).toBeNull();
    expect(writes).toEqual([]);
  });

  it("waits for a form only an options formula reads", async () => {
    const writes = stallSourceForms();
    renderBuilder({
      ...mine,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "pick",
              type: "input",
              kind: "select",
              label: "Pick",
              options: [],
              optionsFormula: {
                inputs: {
                  input1: {
                    kind: "sourceField",
                    sourceFormId: 9,
                    fieldId: "colors",
                  },
                },
                formula: "input1.at(-1) ?? []",
              },
            },
          ],
        },
      ],
      variables: undefined,
    });
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });
    fireEvent.click(screen.getByText("Save Form"));

    expect(
      await screen.findByText(
        "Still loading the questions of forms your formulas read. Try again in a moment.",
      ),
    ).toBeTruthy();
    expect(writes).toEqual([]);
  });
});

describe("FormBuilder save conflict while a source form loads", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  const readsScores = {
    input1: { kind: "sourceField" as const, sourceFormId: 9, fieldId: "score" },
  };

  it.each<[string, FormSchema]>([
    [
      "variable",
      {
        ...mine,
        variables: [
          { name: "scores", inputs: readsScores, formula: "input1.length" },
        ],
      },
    ],
    [
      "options formula",
      {
        ...mine,
        pages: [
          {
            id: "p1",
            fields: [
              ...mine.pages[0].fields,
              {
                id: "score",
                type: "input",
                kind: "select",
                label: "Score",
                options: [],
                optionsFormula: { inputs: readsScores, formula: "[]" },
              },
            ],
          },
        ],
      },
    ],
  ])(
    "waits for the source form their %s reads instead of calling the edits overlapping",
    async (_, theirs) => {
      client.setConfig({
        baseUrl: "http://localhost",
        fetch: async (request: Request) => {
          const { pathname } = new URL(request.url);
          if (request.method !== "GET")
            return new Response(null, { status: 409 });
          if (pathname === "/tasks/listForms") return Response.json([]);
          if (pathname === "/tasks/slug/9")
            return new Promise<Response>(() => {});
          return Response.json({ id: 1, schema: theirs, formSnapshotId: 2 });
        },
      });
      renderBuilder();
      fireEvent.change(screen.getByPlaceholderText("Page title"), {
        target: { value: "Where" },
      });
      fireEvent.click(screen.getByText("Save Form"));

      expect(
        await screen.findByText("Loading the forms your formulas read…"),
      ).toBeTruthy();
      expect(screen.queryByText(/can't be merged/)).toBeNull();
      expect(screen.queryByText("Merge changes")).toBeNull();
    },
  );

  it("says a source form failed to load instead of calling the edits overlapping", async () => {
    const theirs: FormSchema = {
      ...mine,
      variables: [
        {
          name: "scores",
          inputs: {
            input1: { kind: "sourceField", sourceFormId: 9, fieldId: "score" },
          },
          formula: "input1.length",
        },
      ],
    };
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        const { pathname } = new URL(request.url);
        if (request.method !== "GET")
          return new Response(null, { status: 409 });
        if (pathname === "/tasks/listForms") return Response.json([]);
        if (pathname === "/tasks/slug/9")
          return new Response(null, { status: 404 });
        return Response.json({ id: 1, schema: theirs, formSnapshotId: 2 });
      },
    });
    renderBuilder();
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });
    fireEvent.click(screen.getByText("Save Form"));

    expect(
      await screen.findByText(
        "A form your formulas read couldn't be loaded, so these edits can't be merged automatically. Keep your version or take theirs.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/overlap/)).toBeNull();
    expect(screen.queryByText("Merge changes")).toBeNull();
  });
});

describe("FormBuilder save once a source form loads", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  it("names a sub-field the source form's list added since", async () => {
    const saved: unknown[] = [];
    const source: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "pets",
              type: "input",
              kind: "list",
              label: "Pets",
              fields: [
                { id: "pn", type: "input", kind: "text", label: "Pet" },
                { id: "pa", type: "input", kind: "number", label: "Age" },
              ],
            },
          ],
        },
      ],
      outputViews: [],
    };
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        const { pathname } = new URL(request.url);
        if (request.method !== "GET") {
          saved.push(await request.json());
          return Response.json({ id: 1, formSnapshotId: 3 });
        }
        if (pathname === "/tasks/listForms")
          return Response.json([{ id: 9, title: "Survey" }]);
        return Response.json({ id: 9, schema: source, formSnapshotId: 1 });
      },
    });
    renderBuilder({
      ...mine,
      variables: [
        {
          name: "pets",
          inputs: {
            input1: {
              kind: "sourceList",
              sourceFormId: 9,
              fieldId: "pets",
              properties: { pn: "pet" },
            },
          },
          formula: "input1.length",
        },
      ],
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });
    fireEvent.click(screen.getByText("Variables"));
    await screen.findByRole("option", { name: /^Pets \(list\)/ });
    fireEvent.click(screen.getByText("Save Form"));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      schema: {
        variables: [
          {
            inputs: {
              input1: {
                kind: "sourceList",
                sourceFormId: 9,
                fieldId: "pets",
                properties: { pn: "pet", pa: "age" },
              },
            },
          },
        ],
      },
    });
  });
});

describe("FormBuilder page visibility toggle", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  it("follows the selected page's conditions when switching pages", () => {
    const hasCity = {
      conditions: { c1: { kind: "userHasCity", userHasCity: true } },
      formula: "c1",
    } as const;
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async () => Response.json([]),
    });
    renderBuilder({
      ...mine,
      pages: [
        { id: "p1", title: "One", fields: [] },
        { id: "p2", title: "Two", fields: [], visibleIfFormula: hasCity },
        { id: "p3", title: "Three", fields: [], visibleIfFormula: hasCity },
      ],
    });
    const toggle = () =>
      screen.getByLabelText<HTMLInputElement>(
        "Use conditional visibility for this page",
      );

    expect(toggle().checked).toBe(false);
    fireEvent.click(toggle());
    expect(toggle().checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Two" }));
    expect(toggle().checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Three" }));
    expect(toggle().checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "One" }));
    expect(toggle().checked).toBe(false);
  });
});
