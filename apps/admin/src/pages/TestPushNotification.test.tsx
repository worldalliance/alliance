import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import TestPushNotification from "./TestPushNotification";

afterEach(cleanup);

serveApi(
  routes({
    "GET /user/list": () => Response.json({}, { status: 500 }),
  }),
);

it("says when the user list fails to load", async () => {
  render(<TestPushNotification />, queryWrapper());

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});
