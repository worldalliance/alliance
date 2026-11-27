import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { notifyRealMembersText } from "../../../lib/notifyRealMembers";
import { ToastProvider } from "../../../ui/ToastProvider";
import { ScheduleReleaseForm } from "./ScheduleReleaseForm";

const action: ParsedActionDto = {
  ...makeAction({ id: 7, events: [] }),
  slug: "seven",
  followUpForms: [],
  staffPreview: true,
  prerequisiteActionIds: [],
  memberActionStart: null,
  memberActionDeadline: null,
  storedImage: null,
  storedSquareThumbnailImage: null,
  cohortExpression: { type: "Staff" },
};

let evaluationFails = true;
let scheduled: unknown[] = [];
serveApi(
  routes({
    "POST /actions/evaluate-cohort": () =>
      evaluationFails
        ? Response.json({ message: "Evaluation failed" }, { status: 500 })
        : Response.json({ userIds: [1, 2, 3] }),
    "POST /actions/:id/release": async ({ request }) => {
      scheduled.push(await request.json());
      return Response.json({});
    },
  }),
);
beforeEach(() => {
  evaluationFails = true;
  scheduled = [];
});
afterEach(cleanup);

const renderForm = ({ disabled = false } = {}) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <ScheduleReleaseForm action={action} disabled={disabled} />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

describe("ScheduleReleaseForm", () => {
  it("shows a failed member count and refuses to schedule", async () => {
    renderForm();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Schedule release…" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("schedules only after the typed phrase, with the members counted", async () => {
    evaluationFails = false;
    renderForm();
    const button = await screen.findByRole<HTMLButtonElement>("button", {
      name: "Schedule release…",
    });
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(screen.getByText(/Notifies 3 members/)).toBeTruthy();

    fireEvent.click(button);
    const phrase = notifyRealMembersText("many");
    const input = await screen.findByPlaceholderText(phrase);
    const confirm = screen.getByRole<HTMLButtonElement>("button", {
      name: "Schedule release",
    });
    expect(confirm.disabled).toBe(true);
    expect(scheduled).toEqual([]);

    fireEvent.change(input, { target: { value: phrase } });
    fireEvent.click(confirm);
    await waitFor(() => expect(scheduled).toHaveLength(1));
  });

  it("refuses to schedule while the task has unsaved changes, and says why", async () => {
    evaluationFails = false;
    renderForm({ disabled: true });

    expect(await screen.findByText(/Notifies 3 members/)).toBeTruthy();
    expect(screen.getByText("Save your changes first")).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Schedule release…",
      }).disabled,
    ).toBe(true);
  });
});
