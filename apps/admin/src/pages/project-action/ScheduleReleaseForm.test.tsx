import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { render, screen } from "@testing-library/react";
import ScheduleReleaseForm from "./ScheduleReleaseForm";

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
  splitId: null,
  cohortExpression: { type: "Staff" },
};

serveApi(
  routes({
    "POST /actions/evaluate-cohort": () =>
      Response.json({ message: "Evaluation failed" }, { status: 500 }),
  }),
);

describe("ScheduleReleaseForm", () => {
  it("shows a failed member count and refuses to schedule", async () => {
    render(
      <ToastProvider>
        <ScheduleReleaseForm action={action} disabled={false} />
      </ToastProvider>,
      queryWrapper(),
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Schedule release" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
