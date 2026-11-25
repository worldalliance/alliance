import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { makeParsedAction } from "../../lib/testing/parsedAction";
import { ToastProvider } from "../../ui/ToastProvider";
import ActionDashboardToolbar from "./ActionDashboardToolbar";
import type { ActionExport } from "./useActionExport";

const action = makeParsedAction();

const actionExport: ActionExport = {
  exportActionOpen: false,
  exportActionEvents: false,
  setExportActionEvents: () => {},
  exportActionTaskForm: false,
  setExportActionTaskForm: () => {},
  exportActionSuite: false,
  setExportActionSuite: () => {},
  jsonCopied: false,
  handleExportActionOpen: async () => {},
  handleExportAction: async () => {},
};

const renderToolbar = (unsaved: boolean) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <ActionDashboardToolbar
          action={action}
          actionExport={actionExport}
          imageUploading={false}
          unsaved={unsaved}
          onDuplicate={async () => {}}
          onArchive={async () => {}}
        />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const duplicate = () =>
  screen.getByRole<HTMLButtonElement>("button", {
    name: /^duplicate action$/i,
  });

it("disables Duplicate while the action has unsaved edits, saying why", () => {
  renderToolbar(true);

  expect(duplicate().disabled).toBe(true);
  expect(
    screen.getByText(/^Save your changes on Action details to duplicate/),
  ).toBeTruthy();
});

it("offers Duplicate once the edits are saved", () => {
  renderToolbar(false);

  expect(duplicate().disabled).toBe(false);
  expect(screen.queryByText(/^Save your changes on Action details/)).toBeNull();
});
