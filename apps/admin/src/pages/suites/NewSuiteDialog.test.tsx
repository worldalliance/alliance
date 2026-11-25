import type { ActionSuiteDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import NewSuiteDialog from "./NewSuiteDialog";
import SuitesPage from "./SuitesPage";

let createStatus = 200;

serveApi(
  routes({
    "GET /actions/suites": () => Response.json([]),
    "GET /actions/all": () => Response.json([]),
    "POST /actions/createSuite": () =>
      createStatus === 200
        ? Response.json({
            id: 4,
            name: "Autumn",
            actions: [],
            events: [],
            reminderGroups: [],
            generalUpdates: [],
            isPartitioned: false,
          } satisfies ActionSuiteDto)
        : Response.json(
            { message: "name must be shorter than or equal to 255 characters" },
            { status: createStatus },
          ),
  }),
);

beforeEach(() => {
  createStatus = 200;
});

const open = (entries = ["/tasks/suites/new"]) => {
  const router = createMemoryRouter(
    [
      {
        path: "/tasks/suites",
        element: <SuitesPage />,
        children: [{ path: "new", element: <NewSuiteDialog /> }],
      },
      { path: "/tasks/suites/:suiteId", element: null },
      { path: "/tasks", element: null },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    queryWrapper(),
  );
  return router;
};

const submit = (name = "Autumn", entries?: string[]) => {
  const router = open(entries);
  fireEvent.change(screen.getByLabelText("Suite name"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create suite" }));
  return router;
};

it("opens the created suite", async () => {
  const router = submit();

  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/tasks/suites/4"),
  );
});

it("leaves no New suite behind the created suite, so Back returns to the list", async () => {
  const router = submit("Autumn", ["/tasks/suites", "/tasks/suites/new"]);
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/tasks/suites/4"),
  );

  await router.navigate(-1);

  expect(router.state.location.pathname).toBe("/tasks/suites");
});

it("goes back to where it was opened from on Cancel", async () => {
  const router = open(["/tasks", "/tasks/suites/new"]);

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/tasks"));
});

it("shows the server's reason for refusing the suite", async () => {
  createStatus = 400;
  submit();

  expect(
    await screen.findByText(
      "name must be shorter than or equal to 255 characters",
    ),
  ).toBeDefined();
});

it("asks for a name instead of creating a nameless suite", async () => {
  const router = submit("  ");

  expect(await screen.findByText("Enter a suite name")).toBeTruthy();
  expect(router.state.location.pathname).toBe("/tasks/suites/new");
});

it("clears the missing-name error once a name is typed", async () => {
  submit("  ");
  await screen.findByText("Enter a suite name");

  fireEvent.change(screen.getByLabelText("Suite name"), {
    target: { value: "Autumn" },
  });

  expect(screen.queryByText("Enter a suite name")).toBeNull();
  expect(
    screen.getByLabelText("Suite name").getAttribute("aria-describedby"),
  ).toBeNull();
});

it("keeps the missing-name error while the name is only spaces", async () => {
  submit("");
  await screen.findByText("Enter a suite name");

  fireEvent.change(screen.getByLabelText("Suite name"), {
    target: { value: " " },
  });

  expect(screen.getByText("Enter a suite name")).toBeTruthy();
});

it("keeps the server's refusal while the name is edited", async () => {
  createStatus = 400;
  submit();
  const refusal = "name must be shorter than or equal to 255 characters";
  await screen.findByText(refusal);

  fireEvent.change(screen.getByLabelText("Suite name"), {
    target: { value: "Autum" },
  });

  expect(screen.getByText(refusal)).toBeTruthy();
});

it("drops the server's refusal when a blank name is submitted next", async () => {
  createStatus = 400;
  submit();
  const refusal = "name must be shorter than or equal to 255 characters";
  await screen.findByText(refusal);

  fireEvent.change(screen.getByLabelText("Suite name"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create suite" }));

  expect(await screen.findByText("Enter a suite name")).toBeTruthy();
  expect(screen.queryByText(refusal)).toBeNull();
});
