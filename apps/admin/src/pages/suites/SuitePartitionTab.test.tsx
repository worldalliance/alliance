import type {
  ActionSuiteDto,
  SuitePartitionDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { useActionSuiteAdmin } from "../../lib/useActionSuiteAdmin";
import { ToastProvider } from "../../ui/ToastProvider";
import { SuitePartitionTab } from "./SuitePartitionTab";

let converts: number;
let convertStatus: number;
let partitioned: boolean;

const partition: SuitePartitionDto = {
  versionId: 1,
  parts: [
    {
      id: "00000000-0000-4000-8000-0000000000e1",
      name: "Everyone else",
      text: null,
      fallback: null,
      noRequiredWorkTick: null,
      cells: [],
    },
  ],
  actions: [{ id: 1, name: "Call" }],
  launched: false,
  launchFailedAt: null,
  launchFailure: null,
};

serveApi(
  routes({
    "GET /actions/suite/:id": () =>
      Response.json({
        id: 7,
        name: "Suite",
        actions: [makeAction()],
        events: [],
        reminderGroups: [],
        generalUpdates: [],
        isPartitioned: partitioned,
      } satisfies ActionSuiteDto),
    "GET /actions/suite/:suiteId/partition": () => Response.json(partition),
    "POST /actions/suite/:suiteId/partition": () => {
      converts += 1;
      if (convertStatus !== 201)
        return Response.json(
          { message: "Refused." },
          { status: convertStatus },
        );
      partitioned = true;
      return Response.json(partition, { status: 201 });
    },
  }),
);

beforeEach(() => {
  converts = 0;
  convertStatus = 201;
  partitioned = false;
});

/** The tab as the suite page mounts it, with the suite reloaded after a convert. */
function Tab({ launched }: { launched: boolean }) {
  const { suite } = useActionSuiteAdmin(7);
  return suite.data ? (
    <SuitePartitionTab suite={suite.data} launched={launched} />
  ) : null;
}

const renderTab = (launched = false) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <LeaveGuard>
            <Tab launched={launched} />
          </LeaveGuard>
        ),
      },
    ],
    { initialEntries: ["/"] },
  );
  const query = queryWrapper();
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
  return query.client;
};

const answerConfirm = async (label: string) => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Partition this suite…" }),
  );
  await screen.findByText(/This can't be undone/);
  const buttons = screen.getAllByRole("button", { name: label });
  fireEvent.click(buttons[buttons.length - 1]);
};

it("partitions the suite, or says why it can't", async () => {
  convertStatus = 400;
  renderTab();
  await answerConfirm("Partition suite");
  expect(
    (await screen.findByText("Refused.")).closest("[role=alert]"),
  ).not.toBeNull();
  expect(converts).toBe(1);
});

it("reloads the suite and the suite list once it's partitioned, so the page shows the editor and the action form hides its rules", async () => {
  const client = renderTab();
  const suites = queryKeys.actionSuitesAdmin();
  client.setQueryData(suites, []);
  await answerConfirm("Partition suite");
  await waitFor(() =>
    expect(client.getQueryState(suites)?.isInvalidated).toBe(true),
  );
  expect(converts).toBe(1);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "1. Everyone else" }),
    ),
  );
});

it("asks before partitioning, since it can't be undone", async () => {
  renderTab();
  await answerConfirm("Cancel");
  await waitFor(() =>
    expect(screen.queryByText(/This can't be undone/)).toBeNull(),
  );
  expect(converts).toBe(0);
});

it("doesn't offer to partition a scheduled suite", async () => {
  renderTab(true);
  expect(await screen.findByText("This suite has no parts")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Partition this suite…" }),
  ).toBeNull();
});
