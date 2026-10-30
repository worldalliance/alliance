import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen } from "@testing-library/react";
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

let profiledIds: number[][] = [];
beforeEach(() => {
  profiledIds = [];
});

serveApi(
  routes(
    {
      "GET /tasks/adminForm/:id": ({ params }) =>
        Response.json({ id: Number(params.id), schema, formSnapshotId: 3 }),
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

it("highlights a card only while previewing the member it picked", async () => {
  renderSavedFormBuilder(1, "/?previewAs=10");
  fireEvent.click(await screen.findByText("Member variants"));
  const checked = () =>
    screen
      .getAllByRole("radio")
      .map((card) => card.getAttribute("aria-checked"));
  expect(checked()).toEqual(["false", "false"]);

  fireEvent.click(screen.getAllByRole("radio")[1]);
  expect(checked()).toEqual(["false", "true"]);

  fireEvent.click(screen.getByRole("button", { name: "Remove Ben" }));
  fireEvent.change(screen.getByPlaceholderText("Search by name"), {
    target: { value: "Ana" },
  });
  fireEvent.click(await screen.findByRole("button", { name: /Ana/ }));
  expect(
    await screen.findByRole("button", { name: "Remove Ana" }),
  ).toBeTruthy();
  expect(checked()).toEqual(["false", "false"]);
});
