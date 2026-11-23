import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import SuiteSplitSection from "./SuiteSplitSection";

let converts: number;
let convertStatus: number;

serveApi(
  routes({
    "POST /actions/suite/:suiteId/split": () => {
      converts += 1;
      return convertStatus === 201
        ? Response.json({}, { status: 201 })
        : Response.json(
            { message: "Clear them first on: Call." },
            { status: convertStatus },
          );
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
          <SuiteSplitSection
            suiteId={7}
            usesGroups={false}
            scheduled={scheduled}
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
  fireEvent.click(screen.getByRole("button", { name: "Use groups" }));
  await screen.findByText(/This suite can't stop using groups/);
  const buttons = screen.getAllByRole("button", { name: label });
  fireEvent.click(buttons[buttons.length - 1]);
};

it("starts using groups, or says why it can't", async () => {
  convertStatus = 400;
  renderSection();
  await answerConfirm("Use groups");
  expect(
    (await screen.findByText("Clear them first on: Call.")).getAttribute(
      "role",
    ),
  ).toBe("alert");
  expect(converts).toBe(1);
});

it("reloads the suite once it uses groups, so the page shows the editor", async () => {
  const client = renderSection();
  const suite = queryKeys.actionSuiteAdmin(7);
  client.setQueryData(suite, {});
  await answerConfirm("Use groups");
  await waitFor(() =>
    expect(client.getQueryState(suite)?.isInvalidated).toBe(true),
  );
  expect(converts).toBe(1);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Groups" }),
    ),
  );
});

it("asks before using groups, since a suite can't stop", async () => {
  renderSection();
  await answerConfirm("Cancel");
  await waitFor(() =>
    expect(screen.queryByText(/This suite can't stop using groups/)).toBeNull(),
  );
  expect(converts).toBe(0);
});

it("offers no groups on a scheduled suite", () => {
  renderSection(true);
  expect(screen.queryByRole("button", { name: "Use groups" })).toBeNull();
});
