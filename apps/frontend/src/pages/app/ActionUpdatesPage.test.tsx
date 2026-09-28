import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import ActionUpdatesPage from "./ActionUpdatesPage";

serveApi(
  routes({
    "GET /actions/allUpdates": () => {
      throw new TypeError("Failed to fetch");
    },
  }),
);

afterEach(cleanup);

it("reports an unreachable server", async () => {
  render(
    <MemoryRouter>
      <ActionUpdatesPage />
    </MemoryRouter>,
    { wrapper: queryWrapper().wrapper },
  );
  expect(await screen.findByText("Failed to load action updates")).toBeTruthy();
});
