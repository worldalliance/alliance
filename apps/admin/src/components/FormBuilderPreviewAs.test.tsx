import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { renderSavedFormBuilder } from "../lib/testing/renderFormBuilder";

const schema: FormSchema = {
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
            conditions: { c1: { kind: "userHasCity", userHasCity: true } },
          },
        },
      ],
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

let profiledIds: number[][] = [];
beforeEach(() => {
  profiledIds = [];
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
        Response.json([
          {
            id: 10,
            name: "Ana",
            profilePicture: null,
            hasActiveContract: true,
          },
          {
            id: 11,
            name: "Ben",
            profilePicture: null,
            hasActiveContract: true,
          },
          {
            id: 12,
            name: "Cy",
            profilePicture: null,
            hasActiveContract: false,
          },
        ]),
      "POST /tasks/visibilityProfiles": async ({ request }) => {
        const { userIds }: { userIds: number[] } = await request.json();
        profiledIds.push(userIds);
        return Response.json({
          profiles: [
            { results: [true], userIds: [10] },
            { results: [false], userIds: [11] },
          ],
        });
      },
    },
    () => Response.json([]),
  ),
);

it("opens a link to preview as a member on the preview, as that member", async () => {
  const router = renderSavedFormBuilder(1, "/?previewAs=10");

  expect(await screen.findByRole("button", { name: "Edit" })).toBeTruthy();
  expect(await screen.findByText("Ana")).toBeTruthy();
  expect(
    await screen.findByRole("button", { name: /\(Preview Mode\)/ }),
  ).toBeTruthy();
  expect(router.state.location.search).toBe("");
});

it("opens the editor without a member to preview as", async () => {
  renderSavedFormBuilder(1, "/");

  expect(await screen.findByRole("button", { name: "Preview" })).toBeTruthy();
});

it("groups only contracted members, folded under how many variants there are", async () => {
  renderSavedFormBuilder(1, "/?previewAs=10");

  const summary = await screen.findByText("Member variants");
  expect(screen.getByText("2 variants")).toBeTruthy();
  expect(summary.closest("details")?.open).toBe(false);
  expect(profiledIds).toEqual([[10, 11]]);
});

it("highlights a card only until the member bar picks someone", async () => {
  renderSavedFormBuilder(1, "/?previewAs=10");
  fireEvent.click(await screen.findByText("Member variants"));
  const checked = () =>
    screen.getAllByRole<HTMLInputElement>("radio").map((card) => card.checked);
  expect(checked()).toEqual([false, false]);

  fireEvent.click(screen.getAllByRole("radio")[1]);
  expect(checked()).toEqual([false, true]);

  fireEvent.click(screen.getByRole("button", { name: "Remove Ben" }));
  fireEvent.change(screen.getByPlaceholderText("Search by name"), {
    target: { value: "Ana" },
  });
  fireEvent.click(await screen.findByRole("button", { name: /Ana/ }));
  expect(
    await screen.findByRole("button", { name: "Remove Ana" }),
  ).toBeTruthy();
  expect(checked()).toEqual([false, false]);

  fireEvent.click(screen.getByRole("button", { name: "Remove Ana" }));
  fireEvent.change(screen.getByPlaceholderText("Search by name"), {
    target: { value: "Ben" },
  });
  fireEvent.click(await screen.findByRole("button", { name: /Ben/ }));
  expect(
    await screen.findByRole("button", { name: "Remove Ben" }),
  ).toBeTruthy();
  expect(checked()).toEqual([false, false]);
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
