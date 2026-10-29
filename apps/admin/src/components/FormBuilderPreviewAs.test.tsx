import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { renderSavedFormBuilder } from "../lib/testing/renderFormBuilder";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [{ id: "q", type: "input", kind: "text", label: "Your name" }],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const readsMissing: FormSchema = {
  ...schema,
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        {
          id: "q",
          type: "input",
          kind: "text",
          label: "Your name",
          visibleIfFormula: {
            formula: "c1",
            conditions: {
              c1: { kind: "hasValue", when: "gone", hasValue: true },
            },
          },
        },
      ],
    },
  ],
};

const readsSourceForm: FormSchema = {
  ...schema,
  variables: [
    {
      name: "missing",
      inputs: {
        input1: { kind: "sourceField", sourceFormId: 9, fieldId: "gone" },
      },
      formula: "input1.length",
    },
  ],
};

let releaseSourceForm = () => {};
const sourceFormHeld = new Promise<void>((resolve) => {
  releaseSourceForm = resolve;
});

serveApi(
  routes(
    {
      "GET /tasks/adminForm/:id": async ({ params }) => {
        if (params.id === "3")
          return Response.json({ statusCode: 500 }, { status: 500 });
        if (params.id === "9") await sourceFormHeld;
        return Response.json({
          id: Number(params.id),
          schema:
            { "2": readsMissing, "4": readsSourceForm }[params.id!] ?? schema,
          formSnapshotId: 3,
        });
      },
      "GET /user/list": () =>
        Response.json([{ id: 10, name: "Ana", profilePicture: null }]),
    },
    () => Response.json([]),
  ),
);

it("opens a link to preview as a member on the preview, as that member", async () => {
  const router = renderSavedFormBuilder(1, "/?previewAs=10");

  expect(await screen.findByRole("button", { name: "Edit" })).toBeTruthy();
  expect(await screen.findByText("Ana")).toBeTruthy();
  expect(router.state.location.search).toBe("");
});

it("opens the editor without a member to preview as", async () => {
  renderSavedFormBuilder(1, "/");

  expect(await screen.findByRole("button", { name: "Preview" })).toBeTruthy();
});

it("says so when a link names a member the user list lacks", async () => {
  renderSavedFormBuilder(1, "/?previewAs=999");

  expect(
    await screen.findByText("Member #999 isn't in the user list."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /\(Preview Mode\)/ })).toBeNull();
});

it.each([
  ["has an issue", 2],
  ["didn't load", 3],
])(
  "opens the issue list instead of the preview when the form %s",
  async (_, formId) => {
    renderSavedFormBuilder(formId, "/?previewAs=10");

    expect(
      await screen.findByText("Fix 1 issue before previewing"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  },
);

it("waits for the forms a variable reads before opening the preview", async () => {
  renderSavedFormBuilder(4, "/?previewAs=10");

  expect(await screen.findByText("Your name")).toBeTruthy();
  await act(async () => {});
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  await act(async () => releaseSourceForm());

  expect(await screen.findByText("Fix 1 issue before previewing")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
});
