import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { makeParsedAction } from "../../lib/testing/parsedAction";
import { ToastProvider } from "../../ui/ToastProvider";
import type { ActionExport } from "../action-dashboard/useActionExport";
import { TaskCommands, UNSAVED_DUPLICATE_REASON } from "./TaskCommands";

const actionExport: ActionExport = {
  exportActionOpen: false,
  exportActionEvents: false,
  setExportActionEvents: () => {},
  exportActionTaskForm: false,
  setExportActionTaskForm: () => {},
  exportActionSuite: false,
  setExportActionSuite: () => {},
  jsonCopied: false,
  exportError: null,
  handleExportActionOpen: async () => {},
  handleExportAction: async () => {},
};

const renderCommands = (params: {
  unsaved: boolean;
  staffPreview?: boolean;
  onDuplicate?: () => Promise<void>;
}) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <TaskCommands
          task={makeParsedAction({
            staffPreview: params.staffPreview ?? false,
          })}
          commands={{
            handleDuplicate: params.onDuplicate ?? (async () => {}),
            handleArchive: async () => {},
          }}
          actionExport={actionExport}
          imageUploading={false}
          unsaved={params.unsaved}
          memberPageUrl="https://example.org/actions/1"
        />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const duplicate = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^More/ }));
  return screen.findByRole("menuitem", { name: /^Duplicate task…/ });
};

it("disables Duplicate while the task has unsaved edits, saying why", async () => {
  renderCommands({ unsaved: true });

  const item = await duplicate();
  expect(item.getAttribute("aria-disabled")).toBe("true");
  expect(item.textContent).toContain(UNSAVED_DUPLICATE_REASON);
});

it("offers Duplicate once the edits are saved", async () => {
  renderCommands({ unsaved: false });

  const item = await duplicate();
  expect(item.getAttribute("aria-disabled")).toBeNull();
  expect(item.textContent).not.toContain(UNSAVED_DUPLICATE_REASON);
});

it("says what a copy exposes before duplicating", async () => {
  const onDuplicate = jest.fn(async () => {});
  renderCommands({ unsaved: false, staffPreview: true, onDuplicate });

  fireEvent.click(await duplicate());
  expect(
    await screen.findByText(
      /Staff preview is on, so staff see the copy at once\./,
    ),
  ).toBeTruthy();
  expect(onDuplicate).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Duplicate task" }));
  await waitFor(() => expect(onDuplicate).toHaveBeenCalledTimes(1));
});
