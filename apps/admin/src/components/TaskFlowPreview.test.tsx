import type { FormSchema } from "@alliance/common/forms/form-schema";
import { taskFlow, taskHeaders } from "@alliance/shared/lib/copy";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import {
  renderFormBuilder,
  renderSavedFormBuilder,
  renderTaskFormBuilder,
} from "../lib/testing/renderFormBuilder";
import { taskFlowPreviewCopy } from "./TaskFlowPreview";

const CLOSE_TIMEOUT = 3000;

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "h1", type: "display", kind: "header", text: "About you" },
        {
          id: "name",
          type: "input",
          kind: "text",
          label: "Your name",
          required: true,
        },
      ],
    },
    {
      id: "p2",
      fields: [
        { id: "h2", type: "display", kind: "header", text: "Your view" },
        { id: "view", type: "input", kind: "text", label: "Your view" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const unknownKindSchema = {
  ...schema,
  pages: [
    {
      id: "p1",
      fields: [{ id: "c1", type: "display", kind: "carousel", text: "" }],
    },
  ],
};

const locationSchema: FormSchema = {
  ...schema,
  pages: [
    {
      id: "p1",
      fields: [{ id: "where", type: "display", kind: "userLocation" }],
    },
  ],
};

const rowSchema: FormSchema = {
  ...schema,
  pages: [
    {
      ...schema.pages[0],
      fields: [
        { id: "h1", type: "display", kind: "header", text: "#{row.type} form" },
        ...schema.pages[0].fields.slice(1),
      ],
    },
    schema.pages[1],
  ],
  rowList: {
    rows: [{ type: "City" }, { type: "County" }],
    keyFields: ["type"],
  },
};

const formSchemas: Record<string, object> = {
  "3": unknownKindSchema,
  "4": locationSchema,
};

let requests: string[] = [];
beforeEach(() => {
  requests = [];
});

const api = routes(
  {
    "GET /tasks/adminForm/:id": ({ params }) =>
      Response.json({
        id: Number(params.id),
        schema: formSchemas[params.id] ?? schema,
        formSnapshotId: 3,
        usedInAction:
          params.id === "2" ? undefined : { id: 5, name: "Oat milk" },
      }),
    "GET /user/list": () =>
      Response.json([
        {
          id: 10,
          name: "Ana",
          profilePicture: null,
          hasActiveContract: true,
          customCityString: "Leeds",
        },
      ]),
    "GET /user/mylocation": () =>
      Response.json({ city: { name: "Staff city", countryName: "Spain" } }),
  },
  () => Response.json([]),
);
serveApi((request) => {
  requests.push(`${request.method} ${new URL(request.url).pathname}`);
  return api(request);
});

const writes = () => requests.filter((request) => !request.startsWith("GET "));

const openPreview = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
  expect(await screen.findByText(taskFlowPreviewCopy.description)).toBeTruthy();
};

// The flow's buttons stay disabled until its saved position has loaded.
const clickWhenEnabled = async (name: string) => {
  const button = await screen.findByRole<HTMLButtonElement>("button", { name });
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
};

const completeFlow = async () => {
  await clickWhenEnabled(taskFlow.begin);
  fireEvent.change(await screen.findByRole("textbox", { name: /Your name/ }), {
    target: { value: "Sam" },
  });
  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.submit }));
  await screen.findByRole("heading", { name: taskFlow.complete });
};

const completedCard = () =>
  screen.findByText(
    taskHeaders.actionPage.completed,
    {},
    { timeout: CLOSE_TIMEOUT },
  );

it("previews a task form through the members' task flow, saving nothing", async () => {
  renderTaskFormBuilder(schema);
  await openPreview();
  expect(screen.getByText("About you")).toBeTruthy();

  await completeFlow();
  expect(writes()).toEqual([]);
  expect(screen.getByRole("button", { name: taskFlow.viewTasks })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: taskFlow.inviteFriend }));

  expect(await completedCard()).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  expect(writes()).toEqual([]);
});

it("opens the full-screen flow below the builder's header", async () => {
  renderTaskFormBuilder(schema);
  await openPreview();
  const description = screen.getByText(taskFlowPreviewCopy.description);
  await clickWhenEnabled(taskFlow.begin);
  const answer = await screen.findByRole("textbox", { name: /Your name/ });

  let area = answer.parentElement;
  while (area && !area.contains(description)) area = area.parentElement;
  expect(area?.contains(screen.getByRole("button", { name: "Edit" }))).toBe(
    false,
  );
});

it("closes the completion screen into the completed card from View tasks", async () => {
  renderTaskFormBuilder(schema);
  await openPreview();
  await completeFlow();
  fireEvent.click(screen.getByRole("button", { name: taskFlow.viewTasks }));

  expect(await completedCard()).toBeTruthy();
  await clickWhenEnabled(taskFlow.view);
  const answer = await screen.findByRole<HTMLInputElement>(
    "textbox",
    { name: /Your name/ },
    { timeout: CLOSE_TIMEOUT },
  );
  expect(answer.value).toBe("Sam");
});

it("starts over from an empty start card", async () => {
  renderTaskFormBuilder(schema);
  await openPreview();
  await completeFlow();
  fireEvent.click(screen.getByRole("button", { name: taskFlow.viewTasks }));
  await completedCard();

  fireEvent.click(
    screen.getByRole("button", { name: taskFlowPreviewCopy.startOver }),
  );
  expect(screen.getByText(taskFlowPreviewCopy.description)).toBeTruthy();
  await clickWhenEnabled(taskFlow.begin);
  const name = await screen.findByRole<HTMLInputElement>(
    "textbox",
    { name: /Your name/ },
    { timeout: CLOSE_TIMEOUT },
  );
  expect(name.value).toBe("");
});

it("previews a saved form an action uses as its task form through the task flow, as the linked member", async () => {
  const router = renderSavedFormBuilder(1, "/?previewAs=10");

  expect(await screen.findByText(taskFlowPreviewCopy.description)).toBeTruthy();
  expect(await screen.findByText("Ana")).toBeTruthy();
  expect(router.state.location.search).toBe("");
});

it("shows the previewed member's city, not the staff member's own", async () => {
  renderSavedFormBuilder(4, "/?previewAs=10");
  await clickWhenEnabled(taskFlow.begin);

  expect(await screen.findByText(/Leeds/)).toBeTruthy();
  expect(requests).not.toContain("GET /user/mylocation");
});

it("starts over as the newly picked row", async () => {
  renderTaskFormBuilder(rowSchema);
  await openPreview();
  await completeFlow();
  fireEvent.click(screen.getByRole("button", { name: taskFlow.viewTasks }));
  await completedCard();

  fireEvent.change(screen.getByLabelText("Preview as row"), {
    target: { value: "1" },
  });
  expect(screen.queryByText(taskHeaders.actionPage.completed)).toBeNull();
  await clickWhenEnabled(taskFlow.begin);
  expect(
    await screen.findByRole(
      "heading",
      { name: "County form" },
      { timeout: CLOSE_TIMEOUT },
    ),
  ).toBeTruthy();
});

it("titles a blocked task form's screen with its own action", async () => {
  renderSavedFormBuilder(3, "/");
  await openPreview();
  await clickWhenEnabled(taskFlow.begin);

  expect(await screen.findByText("Oat milk")).toBeTruthy();
});

it("keeps the plain preview for a saved form no action uses as its task form", async () => {
  renderSavedFormBuilder(2, "/");
  fireEvent.click(await screen.findByRole("button", { name: "Preview" }));

  expect(
    await screen.findByRole("textbox", { name: /Your name/ }),
  ).toBeTruthy();
  expect(screen.queryByText(taskFlowPreviewCopy.description)).toBeNull();
});

it("keeps the plain preview for forms that aren't task forms", async () => {
  renderFormBuilder(schema);
  await screen.findByRole("button", { name: "Preview" });
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));

  expect(
    await screen.findByRole("textbox", { name: /Your name/ }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: taskFlow.begin })).toBeNull();
  expect(screen.queryByText(taskFlowPreviewCopy.description)).toBeNull();
});
