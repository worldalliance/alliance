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
import GeneralUpdatesPage from "./GeneralUpdatesPage";

let updates = async () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

serveApi(routes({ "GET /actions/generalUpdates": () => updates() }));

afterEach(cleanup);

it("offers a retry when general updates fail to load", async () => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <GeneralUpdatesPage />
    </MemoryRouter>,
    { wrapper },
  );
  await screen.findByText("Couldn't load general updates.");

  const { promise, resolve } = Promise.withResolvers<Response>();
  updates = () => promise;
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() =>
    expect(screen.getByText("Try again").closest("button")?.disabled).toBe(
      true,
    ),
  );
  screen.getByText("Couldn't load general updates.");

  resolve(
    Response.json([
      { id: 1, name: "Quarterly update", priority: 0, schema: {} },
    ]),
  );
  await screen.findByText("Quarterly update");
  expect(screen.queryByText("Couldn't load general updates.")).toBeNull();
});
