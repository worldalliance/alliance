import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { screen } from "@testing-library/react";
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

serveApi(
  routes(
    {
      "GET /tasks/adminForm/:id": ({ params }) =>
        Response.json({ id: Number(params.id), schema, formSnapshotId: 3 }),
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
