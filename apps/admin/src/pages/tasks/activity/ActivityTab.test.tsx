import type { CohortDecisionDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import type { TaskTabProps } from "../taskTabs";
import { ActivityTab } from "./ActivityTab";

const member = (
  userId: number,
  userName: string,
  included: boolean,
): CohortDecisionDto => ({
  userId,
  userName,
  included,
  reason: "launch",
  resolvedAt: "2026-01-01T00:00:00.000Z",
  corrections: [],
});

let decisions: CohortDecisionDto[] = [];
let correctionStatus = 200;
const bodies: unknown[] = [];

serveApi(
  routes({
    "GET /cohort-decisions/action/7": () => Response.json(decisions),
    "POST /cohort-decisions/action/7/user/1/correction": async ({
      request,
    }) => {
      bodies.push(await request.json());
      return correctionStatus === 200
        ? Response.json(member(1, "Ada Lovelace", false))
        : Response.json({ message: "Nope." }, { status: correctionStatus });
    },
  }),
);

afterEach(() => {
  decisions = [];
  correctionStatus = 200;
  bodies.length = 0;
});

const openTab = jest.fn();

const renderTab = () =>
  render(
    <MemoryRouter>
      <ActivityTab
        {...({
          task: makeParsedAction({ id: 7 }),
          openTab,
        } as unknown as TaskTabProps)}
      />
    </MemoryRouter>,
    queryWrapper(),
  );

it("says why a draft has no decisions", async () => {
  renderTab();
  expect(await screen.findByText("No decisions yet")).toBeTruthy();
  expect(screen.getByText(/draft/)).toBeTruthy();
});

it("summarises, searches and links members", async () => {
  decisions = [
    member(1, "Ada Lovelace", true),
    member(2, "Grace Hopper", false),
  ];
  renderTab();

  await screen.findByText(/1 assigned, 1 excluded/);
  expect(
    screen.getByRole("link", { name: "Ada Lovelace" }).getAttribute("href"),
  ).toBe("/members/1");
  fireEvent.change(screen.getByLabelText("Search members"), {
    target: { value: "grace" },
  });
  expect(screen.queryByText("Ada Lovelace")).toBeNull();
  expect(screen.getByText("Grace Hopper")).toBeTruthy();
});

it("requires a reason to correct a decision, then sends it", async () => {
  decisions = [member(1, "Ada Lovelace", true)];
  renderTab();

  fireEvent.click(
    await screen.findByRole("button", {
      name: "Correct Ada Lovelace's decision",
    }),
  );
  expect(await screen.findByText("Exclude Ada Lovelace?")).toBeTruthy();
  expect(screen.getByText(/Nothing is sent to them/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Exclude member" }));
  expect(await screen.findByText("Say why you are correcting it")).toBeTruthy();
  expect(bodies).toEqual([]);

  fireEvent.change(screen.getByLabelText(/Reason/), {
    target: { value: "Left the group" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Exclude member" }));
  await waitFor(() =>
    expect(bodies).toEqual([{ included: false, note: "Left the group" }]),
  );
});

it("shows a refused correction in the dialog and keeps it open", async () => {
  decisions = [member(1, "Ada Lovelace", true)];
  correctionStatus = 409;
  renderTab();

  fireEvent.click(
    await screen.findByRole("button", {
      name: "Correct Ada Lovelace's decision",
    }),
  );
  fireEvent.change(await screen.findByLabelText(/Reason/), {
    target: { value: "x" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Exclude member" }));
  expect(await screen.findByText("Nope.")).toBeTruthy();
  expect(screen.getByText("Exclude Ada Lovelace?")).toBeTruthy();
});
