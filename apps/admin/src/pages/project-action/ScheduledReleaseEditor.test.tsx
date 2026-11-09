import type { RescheduleReleaseDto } from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { addDays } from "date-fns";
import { fromPacificInput, toPacificInput } from "../../lib/releaseDates";
import ScheduledReleaseEditor from "./ScheduledReleaseEditor";

const launchAt = addDays(new Date(), 5);
const deadlineAt = addDays(launchAt, 7);

const action: ParsedActionDto = {
  ...makeAction({
    id: 7,
    events: [
      makeEvent({ id: 1, date: launchAt.toISOString() }),
      makeEvent({
        id: 2,
        newStatus: "office_action",
        date: deadlineAt.toISOString(),
      }),
    ],
  }),
  slug: "seven",
  followUpForms: [],
  staffPreview: true,
  prerequisiteActionIds: [],
  memberActionStart: launchAt.toISOString(),
  memberActionDeadline: deadlineAt.toISOString(),
  storedImage: null,
  storedSquareThumbnailImage: null,
  cohortExpression: null,
};

let bodies: RescheduleReleaseDto[] = [];
serveApi(
  routes({
    "PATCH /actions/:id/release": async ({ request }) => {
      bodies.push(await request.json());
      return Response.json({});
    },
  }),
);
beforeEach(() => {
  bodies = [];
});

describe("ScheduledReleaseEditor", () => {
  it("saves a new launch and deadline in one request", async () => {
    render(
      <ToastProvider>
        <ScheduledReleaseEditor action={action} disabled={false} />
      </ToastProvider>,
      queryWrapper(),
    );
    const newLaunch = addDays(launchAt, 7);
    const newDeadline = addDays(deadlineAt, 7);
    fireEvent.change(screen.getByLabelText("Launch (Pacific)"), {
      target: { value: toPacificInput(newLaunch) },
    });
    fireEvent.change(screen.getByLabelText("Deadline (Pacific)"), {
      target: { value: toPacificInput(newDeadline) },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save dates" }));
    });

    expect(bodies).toEqual([
      {
        launch: fromPacificInput(toPacificInput(newLaunch))?.toISOString(),
        deadline: fromPacificInput(toPacificInput(newDeadline))?.toISOString(),
      },
    ]);
  });
});
