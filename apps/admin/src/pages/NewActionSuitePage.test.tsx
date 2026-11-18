import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import NewActionSuitePage from "./NewActionSuitePage";

let createStatus = 200;

serveApi(
  routes({
    "GET /actions/suites": () => Response.json([]),
    "POST /actions/createSuite": () =>
      createStatus === 200
        ? Response.json({
            id: 4,
            name: "Autumn",
            actions: [],
            events: [],
            reminderGroups: [],
            generalUpdates: [],
          })
        : Response.json(
            { message: "name must be shorter than or equal to 255 characters" },
            { status: createStatus },
          ),
  }),
);

beforeEach(() => {
  createStatus = 200;
});

const submit = (name = "Autumn") => {
  const router = createMemoryRouter(
    [
      { path: "/new-suite", element: <NewActionSuitePage /> },
      { path: "/suites/:suiteId", element: null },
    ],
    { initialEntries: ["/new-suite"] },
  );
  render(<RouterProvider router={router} />, queryWrapper());
  fireEvent.change(screen.getByLabelText("Suite name"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create suite" }));
  return router;
};

it("opens the created suite", async () => {
  const router = submit();

  await waitFor(() => expect(router.state.location.pathname).toBe("/suites/4"));
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

  expect(await screen.findByText("Give the suite a name.")).toBeTruthy();
  expect(router.state.location.pathname).toBe("/new-suite");
});
