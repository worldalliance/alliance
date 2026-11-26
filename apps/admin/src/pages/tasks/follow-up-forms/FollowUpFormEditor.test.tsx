import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { act } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../../components/LeaveGuard";
import { answerLeaveGuard } from "../../../lib/testing/leaveGuard";
import { ToastProvider } from "../../../ui/ToastProvider";
import { FollowUpFormEditor } from "./FollowUpFormEditor";

afterEach(cleanup);

const lookups = {
  availableTags: [],
  tagsLoading: false,
  tagsError: false,
  allActions: [],
  allActionsLoading: false,
  allActionsLoadFailed: false,
  availableUsers: [],
  usersLoading: false,
  usersError: false,
} as never;

function renderEditor(over: {
  form?: Record<string, unknown>;
  onSave?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const onSave = over.onSave ?? mock(async () => {});
  const onDelete = over.onDelete ?? mock(async () => {});
  const form = {
    id: 5,
    formId: 9,
    name: "Check-in",
    instructions: null,
    startDate: "2026-06-01T16:00:00Z",
    endDate: null,
    cohortExpression: null,
    ...over.form,
  } as never;
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <LeaveGuard>
          <FollowUpFormEditor
            form={form}
            lookups={lookups}
            onSave={onSave}
            onDelete={onDelete}
            deleting={false}
            builder={<div>builder</div>}
          />
        </LeaveGuard>
      ),
    },
  ]);
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    queryWrapper(),
  );
  return { onSave, onDelete, router };
}

describe("FollowUpFormEditor", () => {
  it("says an empty cohort shows nobody before saving", () => {
    renderEditor({});
    expect(
      screen.getByText("With no target cohort, nobody sees this form."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save fields" })).toBeTruthy();
  });

  it("saves only on pressing Save fields", async () => {
    const { onSave } = renderEditor({});
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Later" },
    });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save fields" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("asks before a row or tab switch drops unsaved fields, not before a builder switch", async () => {
    const { router } = renderEditor({});
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Later" },
    });
    const confirm = answerLeaveGuard(false);
    await act(() => router.navigate("/?editor=logic"));
    expect(confirm).not.toHaveBeenCalled();
    await act(() => router.navigate("/?editor=logic&form=6"));
    await act(() => router.navigate("/?tab=details"));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(router.state.location.search).toBe("?editor=logic");
    confirm.mockRestore();
  });

  it("asks before deleting, and says responses are kept", async () => {
    const { onDelete } = renderEditor({});
    fireEvent.click(
      screen.getByRole("button", { name: "Delete follow-up form…" }),
    );
    expect(
      await screen.findByText(/responses already submitted are kept/),
    ).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete follow-up form" }),
    );
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it("warns and refuses to save when the stored cohort can't be read", () => {
    const { onSave } = renderEditor({
      form: { cohortExpression: { bogus: true } },
    });
    expect(
      screen.getAllByText(/stored cohort couldn.t be read/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/nobody sees this form/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save fields" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("Saving is off: the stored cohort couldn't be read.")
        .length,
    ).toBeGreaterThan(0);
  });
});
