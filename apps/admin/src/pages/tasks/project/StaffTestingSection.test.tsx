import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ActionPhase } from "../../../lib/actionPhase";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { ToastProvider } from "../../../ui/ToastProvider";
import type { TaskRecordContext } from "../TaskRecord";
import { StaffTestingSection } from "./StaffTestingSection";

afterEach(cleanup);

const ready = {
  shortDescription: "Short",
  body: "Body",
  taskFormId: 3,
  cohortExpression: { type: "Staff" as const },
};

const renderSection = (params: {
  phase: ActionPhase;
  unsaved?: boolean;
  busy?: boolean;
  action?: Parameters<typeof makeParsedAction>[0];
}) => {
  const context: TaskRecordContext = {
    unsaved: params.unsaved ?? false,
    busy: params.busy ?? false,
    setStaffPreview: jest.fn(() => Promise.resolve()),
    openTab: jest.fn(),
  };
  render(
    <MemoryRouter>
      <ToastProvider>
        <StaffTestingSection
          action={makeParsedAction(params.action)}
          phase={params.phase}
          context={context}
        />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  return context;
};

const start = () =>
  screen.getByRole<HTMLButtonElement>("button", {
    name: "Start staff testing…",
  });

describe("StaffTestingSection", () => {
  it("lists what is missing and keeps Start disabled", () => {
    const context = renderSection({ phase: ActionPhase.Draft });
    expect(start().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Task form linked" }));
    expect(context.openTab).toHaveBeenCalledWith("form");
  });

  it("keeps Start disabled while Details has unsaved edits", () => {
    renderSection({
      phase: ActionPhase.Draft,
      unsaved: true,
      action: ready,
    });
    expect(start().disabled).toBe(true);
    expect(screen.getByText("Save your changes first")).toBeTruthy();
  });

  it("says staff are shown the draft and starts only once confirmed", async () => {
    const context = renderSection({ phase: ActionPhase.Draft, action: ready });
    fireEvent.click(start());
    expect(await screen.findByText(/Every staff account/)).toBeTruthy();
    expect(context.setStaffPreview).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Start staff testing" }),
    );
    await waitFor(() =>
      expect(context.setStaffPreview).toHaveBeenCalledWith(true),
    );
  });

  it("shows the status in effect before staff testing, not always Draft", () => {
    renderSection({
      phase: ActionPhase.Draft,
      action: { status: "planned", events: [] },
    });
    screen.getByText("Planned");
    expect(screen.queryByText("Draft")).toBeNull();
  });

  it("stops staff testing", () => {
    const context = renderSection({
      phase: ActionPhase.StaffTesting,
      action: { staffPreview: true },
    });
    screen.getByText("Staff testing", { selector: "span" });
    fireEvent.click(screen.getByRole("button", { name: "Stop staff testing" }));
    expect(context.setStaffPreview).toHaveBeenCalledWith(false);
  });

  it("ignores a press while a write to the task runs", () => {
    const context = renderSection({
      phase: ActionPhase.StaffTesting,
      busy: true,
      action: { staffPreview: true },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stop staff testing" }));
    expect(context.setStaffPreview).not.toHaveBeenCalled();
  });

  it("offers nothing once the release is scheduled", () => {
    renderSection({ phase: ActionPhase.Scheduled });
    expect(screen.queryByText("Staff testing")).toBeNull();
  });
});
