import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import TestPushNotification from "./TestPushNotification";

afterEach(cleanup);

const failure = () => Response.json({}, { status: 500 });
let userList = failure;

serveApi(routes({ "GET /user/list": () => userList() }));

afterEach(() => {
  userList = failure;
});

it("says when the user list fails to load", async () => {
  render(<TestPushNotification />, queryWrapper());

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});

it("stays quiet when a refetch fails after the users loaded", async () => {
  userList = () => Response.json([makeUser({ id: 7, name: "Ana" })]);
  const query = queryWrapper();
  render(<TestPushNotification />, query);
  await waitFor(() => expect(query.client.isFetching()).toBe(0));

  userList = failure;
  await query.client.refetchQueries();
  await waitFor(() => expect(query.client.isFetching()).toBe(0));

  expect(screen.queryByText("Failed to load users.")).toBeNull();
});
