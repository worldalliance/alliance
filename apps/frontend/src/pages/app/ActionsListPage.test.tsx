import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionsListPage from "./ActionsListPage";

let loggedIn = async () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

serveApi(routes({ "GET /actions/loggedIn": () => loggedIn() }));

afterEach(cleanup);

it("offers a retry instead of an empty list and a zero count when actions fail to load", async () => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <ActionsListPage />
    </MemoryRouter>,
    { wrapper },
  );
  await screen.findByText("Couldn't load actions.");
  expect(screen.queryByText("No matching actions")).toBeNull();
  expect(screen.queryByText(/^showing/)).toBeNull();

  const { promise, resolve } = Promise.withResolvers<Response>();
  loggedIn = () => promise;
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() =>
    expect(screen.getByText("Try again").closest("button")?.disabled).toBe(
      true,
    ),
  );

  resolve(Response.json([makeAction({ name: "Call your representative" })]));
  await screen.findByText("Call your representative");
  expect(screen.queryByText("Couldn't load actions.")).toBeNull();
  expect(screen.getByText("showing 1")).toBeTruthy();
});
