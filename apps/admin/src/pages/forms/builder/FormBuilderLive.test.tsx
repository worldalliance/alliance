import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";
import {
  fromSelectionMenu,
  selectElement,
} from "../../../lib/testing/formCanvas";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { renderSavedFormBuilder } from "../../../lib/testing/renderFormBuilder";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "name", type: "input", kind: "text", label: "Name" },
        { id: "town", type: "input", kind: "text", label: "Town" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const writes: string[] = [];
const state: {
  responses: number;
  task: { id: number; status: "draft" | "member_action" } | null;
  countsFail: boolean;
} = { responses: 0, task: null, countsFail: false };

serveApi(
  routes(
    {
      "GET /tasks/adminForm/:id": () =>
        Response.json({ id: 1, schema, formSnapshotId: 3 }),
      "GET /tasks/listForms": () =>
        Response.json([
          {
            id: 1,
            title: "Survey",
            slug: "survey",
            displaySlug: "survey",
            formSnapshotId: 3,
            ...(state.task && {
              usedInAction: { id: state.task.id, name: "Sign up" },
            }),
          },
        ]),
      "POST /tasks/responses/counts": () =>
        state.countsFail
          ? new Response(null, { status: 500 })
          : Response.json([{ formId: 1, count: state.responses }]),
      "GET /actions/adminslug/:id": () =>
        Response.json(
          makeParsedAction({
            id: state.task?.id,
            status: state.task?.status,
          }),
        ),
      "PUT /tasks/updateForm/:formId": ({ params }) => {
        writes.push(params.formId!);
        return Response.json({ id: 1, formSnapshotId: 4 });
      },
    },
    () => Response.json([]),
  ),
);

beforeEach(() => {
  writes.length = 0;
  state.responses = 0;
  state.task = null;
  state.countsFail = false;
});

const removeTown = () => {
  selectElement("Town");
  fromSelectionMenu("Delete question");
};
const save = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
  });

describe("FormBuilder on a live form", () => {
  it("says a form with responses is live, and asks before a save removes a question", async () => {
    state.responses = 3;
    renderSavedFormBuilder(1, "/");
    expect(await screen.findByText("Live")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "About Live" }).textContent,
    ).toContain(
      "This form has 3 responses. Each save reaches members the next time they open the form.",
    );

    removeTown();
    await save();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Save changes that affect answers?");
    expect(dialog.textContent).toContain("This form has 3 responses.");
    expect(dialog.textContent).toContain('Removes the question "Town" (town)');
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writes).toEqual([]);

    await save();
    fireEvent.click(
      await screen.findByRole("button", { name: "Save changes" }),
    );
    await waitFor(() => expect(writes).toEqual(["1"]));
  });

  it("says members can open the task a form belongs to", async () => {
    state.task = { id: 9, status: "member_action" };
    renderSavedFormBuilder(1, "/");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "About Live" }).textContent,
      ).toContain("Members can open this task now"),
    );
  });

  it("saves a copy edit to a live form without asking", async () => {
    state.responses = 2;
    renderSavedFormBuilder(1, "/");
    await screen.findByText("Live");
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "First" },
    });
    await save();
    await waitFor(() => expect(writes).toEqual(["1"]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves a form with no responses and a draft task without asking", async () => {
    state.task = { id: 9, status: "draft" };
    renderSavedFormBuilder(1, "/");
    await screen.findByDisplayValue("One");
    await act(async () => {});
    expect(screen.queryByText("Live")).toBeNull();
    removeTown();
    await save();
    await waitFor(() => expect(writes).toEqual(["1"]));
  });

  it("asks when it couldn't check for responses", async () => {
    state.countsFail = true;
    renderSavedFormBuilder(1, "/");
    expect(
      await screen.findByRole("button", { name: "Unchecked" }),
    ).toBeTruthy();
    removeTown();
    await save();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("This form may have responses.");
  });
});
