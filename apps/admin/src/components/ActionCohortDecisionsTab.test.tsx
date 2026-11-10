import type {
  ArmMovePreviewDto,
  CohortDecisionDto,
  SuiteSplitDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import ActionCohortDecisionsTab from "./ActionCohortDecisionsTab";

const decision: CohortDecisionDto = {
  userId: 5,
  included: true,
  reason: "launch",
  resolvedAt: "2026-01-01T00:00:00.000Z",
  userName: "Ana",
  corrections: [],
};

const split: SuiteSplitDto = {
  id: 4,
  title: "Letters",
  visibilityMode: "combined",
  filterExpression: null,
  launched: true,
  arms: [
    { id: 1, actionId: 1, rule: { type: "USMember" }, optional: false },
    { id: 2, actionId: 2, rule: null, optional: false },
  ],
};

let preview: ArmMovePreviewDto = {
  currentArmActionId: 1,
  hasCompletion: false,
  hasSubmittedResponse: false,
};
let posted: { path: string; body: unknown }[] = [];

const record = async ({ request }: { request: Request }) => {
  posted.push({
    path: new URL(request.url).pathname,
    body: await request.json(),
  });
  return Response.json({});
};

serveApi(
  routes({
    "GET /cohort-decisions/action/1": () => Response.json([decision]),
    "GET /actions/suite/3/splits": () => Response.json([split]),
    "GET /actions/all": () =>
      Response.json([
        adminActionListItem(1, "Call"),
        adminActionListItem(2, "Write"),
      ]),
    "GET /cohort-decisions/action/1/user/5/arm-move": () =>
      Response.json(preview),
    "POST /cohort-decisions/action/:actionId/user/5/move-to-arm": record,
    "POST /cohort-decisions/action/:actionId/user/5/remove-from-split": record,
  }),
);

afterEach(() => {
  preview = {
    currentArmActionId: 1,
    hasCompletion: false,
    hasSubmittedResponse: false,
  };
  posted = [];
});

const renderTab = () =>
  render(
    <MemoryRouter>
      <ActionCohortDecisionsTab
        actionId={1}
        split={{ suiteId: 3, splitId: 4 }}
      />
    </MemoryRouter>,
    queryWrapper(),
  );

it("moves a member into the arm picked, warning that their completion stays behind", async () => {
  preview = { ...preview, hasCompletion: true, hasSubmittedResponse: true };
  renderTab();

  fireEvent.click(
    await screen.findByRole("button", { name: "Move Ana to another arm" }),
  );
  expect(
    await screen.findByText(
      /Ana has a completion and a submitted response on Call\. It stays on that arm as history/,
    ),
  ).toBeTruthy();
  const target = screen.getByLabelText<HTMLSelectElement>("Move to");
  expect(Array.from(target.options, (option) => option.text)).toEqual([
    "Pick an arm…",
    "Write",
  ]);
  const confirm = screen.getByRole("button", { name: "Move member" });
  fireEvent.change(target, { target: { value: "2" } });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Reason (required)"), {
    target: { value: "Asked to write instead" },
  });
  fireEvent.click(confirm);

  await waitFor(() =>
    expect(posted).toEqual([
      {
        path: "/cohort-decisions/action/2/user/5/move-to-arm",
        body: { note: "Asked to write instead" },
      },
    ]),
  );
});

it("removes a member from the split with a note", async () => {
  renderTab();

  fireEvent.click(
    await screen.findByRole("button", { name: "Remove Ana from the split" }),
  );
  expect(await screen.findByText("Now in Call.")).toBeTruthy();
  expect(screen.queryByText(/stays on that arm/)).toBeNull();
  fireEvent.change(screen.getByLabelText("Reason (required)"), {
    target: { value: "Left the country" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Remove from split" }));

  await waitFor(() =>
    expect(posted).toEqual([
      {
        path: "/cohort-decisions/action/1/user/5/remove-from-split",
        body: { note: "Left the country" },
      },
    ]),
  );
});

it("offers no include or exclude correction on an arm", async () => {
  renderTab();

  await screen.findByRole("button", { name: "Move Ana to another arm" });
  expect(
    screen.queryByRole("button", { name: "Correct Ana's decision" }),
  ).toBeNull();
});
