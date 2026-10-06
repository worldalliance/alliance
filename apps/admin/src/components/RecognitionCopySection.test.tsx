import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionUpdateForm } from "../lib/actionUpdateDetails";
import {
  ActionFormStatus,
  NotificationHeldBanner,
  RecognitionCopySection,
} from "./ActionUpdateRecognition";

afterEach(cleanup);

const form = (overrides: Partial<ActionUpdateForm> = {}): ActionUpdateForm => ({
  title: "Letters delivered",
  shortNotifString: "the council voted yes",
  notifyType: "none",
  tagId: "",
  date: "2026-10-01T00:00:00.000Z",
  associatedEventId: "",
  notificationMode: "normal",
  formulas: {
    contributionFormula: null,
    retrospectiveContributionFormula: null,
  },
  ...overrides,
});

const renderSection = (params: {
  form: ActionUpdateForm;
  prepared: boolean;
}) => {
  const onChange = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RecognitionCopySection
        form={params.form}
        mode="normal"
        prepared={params.prepared}
        actionForm={{
          status: ActionFormStatus.Loaded,
          taskFormId: undefined,
          variantFormIds: [],
        }}
        onChange={onChange}
      />
    </QueryClientProvider>,
  );
  return { onChange };
};

describe("RecognitionCopySection", () => {
  it("offers the mode and the active formula while copy can still change", () => {
    renderSection({ form: form(), prepared: false });

    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByText("Contribution")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stops offering edits once each member's copy is frozen", () => {
    renderSection({ form: form(), prepared: true });

    expect(screen.getByText(/copy was frozen/)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("refuses to edit a saved formula it can't read", () => {
    renderSection({ form: form({ formulas: null }), prepared: false });

    expect(screen.getByRole("alert").textContent).toMatch(/can't be read/);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("switches the mode and leaves both saved formulas as they were", () => {
    const formulas = {
      contributionFormula: { inputs: {}, formula: '"3 letters"' },
      retrospectiveContributionFormula: null,
    };
    const { onChange } = renderSection({
      form: form({ formulas }),
      prepared: false,
    });

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "retrospective" },
    });

    expect(onChange).toHaveBeenCalledWith(
      form({ formulas, notificationMode: "retrospective" }),
    );
  });
});

describe("NotificationHeldBanner", () => {
  it("says the notifications are on hold, and why", () => {
    render(
      <NotificationHeldBanner reason="Member7's contribution is empty." />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("notifications are on hold");
    expect(alert.textContent).toContain("Member7's contribution is empty.");
  });
});
