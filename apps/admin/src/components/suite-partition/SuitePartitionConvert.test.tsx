import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import SuitePartitionSection from "./SuitePartitionSection";

let converts: number;
let convertStatus: number;

serveApi(
  routes({
    "POST /actions/suite/:suiteId/partition": () => {
      converts += 1;
      return convertStatus === 201
        ? Response.json({}, { status: 201 })
        : Response.json({ message: "Refused." }, { status: convertStatus });
    },
  }),
);

beforeEach(() => {
  converts = 0;
  convertStatus = 201;
});

const renderSection = (scheduled = false) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SuitePartitionSection
            suiteId={7}
            isPartitioned={false}
            scheduled={scheduled}
            canPartition
          />
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
  fireEvent.click(screen.getByRole("button", { name: "Partition this suite" }));
  await screen.findByText(/This can't be undone/);
  const buttons = screen.getAllByRole("button", { name: label });
  fireEvent.click(buttons[buttons.length - 1]);
};

it("partitions the suite, or says why it can't", async () => {
  convertStatus = 400;
  renderSection();
  await answerConfirm("Partition suite");
  expect((await screen.findByText("Refused.")).getAttribute("role")).toBe(
    "alert",
  );
  expect(converts).toBe(1);
});

it("reloads the suite and the suite list once it's partitioned, so the page shows the editor and the action form hides its rules", async () => {
  const client = renderSection();
  const suite = queryKeys.actionSuiteAdmin(7);
  const suites = queryKeys.actionSuitesAdmin();
  client.setQueryData(suite, {});
  client.setQueryData(suites, []);
  await answerConfirm("Partition suite");
  await waitFor(() => {
    expect(client.getQueryState(suite)?.isInvalidated).toBe(true);
    expect(client.getQueryState(suites)?.isInvalidated).toBe(true);
  });
  expect(converts).toBe(1);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Partition" }),
    ),
  );
});

it("asks before partitioning, since it can't be undone", async () => {
  renderSection();
  await answerConfirm("Cancel");
  await waitFor(() =>
    expect(screen.queryByText(/This can't be undone/)).toBeNull(),
  );
  expect(converts).toBe(0);
});

it("doesn't offer to partition a scheduled suite", () => {
  renderSection(true);
  expect(
    screen.queryByRole("button", { name: "Partition this suite" }),
  ).toBeNull();
});
