import type { FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import FormResponsesView from "../FormResponsesView";

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "mood",
          type: "input",
          kind: "radio",
          label: "Mood",
          options: [
            { value: "o1", label: "Happy" },
            { value: "o2", label: "Sad" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

const answered = (params: {
  id: number;
  name: string;
  mood: string;
  formId: number;
  formSnapshotId: number;
}) =>
  makeFormResponse({
    id: params.id,
    formId: params.formId,
    formSnapshotId: params.formSnapshotId,
    createdAt: `2026-03-0${params.id}T10:00:00.000Z`,
    user: makeUser({ id: params.id, name: params.name }),
    answers: { mood: params.mood },
    schemaSnapshot: schema,
  });

const responses = [
  answered({ id: 1, name: "Ana", mood: "o1", formId: 1, formSnapshotId: 7 }),
  answered({ id: 2, name: "Bea", mood: "o2", formId: 2, formSnapshotId: 8 }),
  answered({ id: 3, name: "Cy", mood: "o1", formId: 1, formSnapshotId: 7 }),
];

const downloads: Blob[] = [];

const renderView = (search: string) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <FormResponsesView
            title="Form"
            form={{ id: 1, title: "Form", formSnapshotId: 7, schema }}
            responses={responses}
            variantOptions={[
              { key: "a", variantId: 1, formId: 1, name: "Alpha" },
              { key: "b", variantId: 2, formId: 2, name: "Beta" },
            ]}
            loading={false}
            error={null}
            refresh={{
              mutate: () => {},
              isPending: false,
              isError: false,
              error: null,
            }}
            withdrawnUserMap={new Map()}
            sidsToUserMap={{}}
            exportFileBase="form"
          />
        ),
      },
    ],
    { initialEntries: [`/${search}`] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
};

const exportAs = async (item: "Export CSV" | "Export HTML") => {
  downloads.length = 0;
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: new RegExp(`^${item}`) }),
  );
  await waitFor(() => expect(downloads).toHaveLength(1));
  return downloads[0].text();
};

beforeEach(() => {
  URL.createObjectURL = (blob: Blob) => {
    downloads.push(blob);
    return "blob:test";
  };
  URL.revokeObjectURL = () => {};
});

it("exports every response when nothing is filtered", async () => {
  renderView("");
  const csv = await exportAs("Export CSV");

  expect(csv.split("\n")).toHaveLength(4);
});

it("exports the variant's rows only, in both formats", async () => {
  renderView("?variant=b");
  const csv = await exportAs("Export CSV");
  expect(csv).toContain("Bea");
  expect(csv).not.toContain("Ana");

  const html = await exportAs("Export HTML");
  expect(html).toContain("<response-count>1</response-count>");
  expect(html).toContain("<filter>Variant: Beta</filter>");
  expect(html).not.toContain("Ana");
});

it("exports the searched rows only", async () => {
  renderView("?q=cy");
  const csv = await exportAs("Export CSV");
  expect(csv.split("\n")).toHaveLength(2);
  expect(csv).toContain("Cy");

  const html = await exportAs("Export HTML");
  expect(html).toContain("<response-count>1</response-count>");
  expect(html).toContain("<filter>Search: cy</filter>");
});

it("exports the version's rows only", async () => {
  renderView("?version=8");
  const csv = await exportAs("Export CSV");
  expect(csv.split("\n")).toHaveLength(2);
  expect(csv).toContain("Bea");

  const html = await exportAs("Export HTML");
  expect(html).toContain("<filter>Version: snapshot 8</filter>");
});

it("combines the variant and the search", async () => {
  renderView("?variant=a&q=ana");
  const csv = await exportAs("Export CSV");

  expect(csv.split("\n")).toHaveLength(2);
  expect(csv).toContain("Ana");
});

it("says how many responses an export holds and which filters apply", async () => {
  renderView("?variant=b&q=bea");
  fireEvent.click(screen.getByRole("button", { name: "Export" }));

  const csv = await screen.findByRole("menuitem", { name: /^Export CSV/ });
  expect(csv.textContent).toContain("1 response · Variant: Beta · Search: bea");
});

it("disables both exports when the filters leave nothing", async () => {
  renderView("?q=nobody");
  fireEvent.click(screen.getByRole("button", { name: "Export" }));

  const csv = await screen.findByRole("menuitem", { name: /^Export CSV/ });
  const html = screen.getByRole("menuitem", { name: /^Export HTML/ });
  expect(csv.getAttribute("aria-disabled")).toBe("true");
  expect(html.getAttribute("aria-disabled")).toBe("true");
});
