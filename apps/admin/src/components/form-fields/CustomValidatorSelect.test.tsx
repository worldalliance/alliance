import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CustomValidatorSelect } from "./CommonControls";

afterEach(cleanup);

const listsAnaAndBen = () =>
  Response.json([
    makeUser({ id: 7, name: "Ana", hasActiveContract: true }),
    makeUser({ id: 8, name: "Ben", hasActiveContract: false }),
  ]);
let userList = listsAnaAndBen;

afterEach(() => {
  userList = listsAnaAndBen;
});

serveApi(
  routes({
    "GET /tasks/customValidators": () => Response.json([]),
    "GET /user/list": () => userList(),
  }),
);

const renderSelect = () => {
  const query = queryWrapper();
  render(
    <CustomValidatorSelect
      type="CustomExpression"
      idArgument={null}
      expression=""
      onChange={() => {}}
    />,
    query,
  );
  return query.client;
};

describe("the custom expression test user picker", () => {
  it("offers only active-contract users", async () => {
    renderSelect();

    expect(await screen.findByRole("option", { name: "Ana (7)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Ben (8)" })).toBeNull();
  });

  it("says when the users fail to load", async () => {
    userList = () => Response.json({}, { status: 500 });
    renderSelect();

    expect(await screen.findByText("Failed to load users")).toBeTruthy();
  });

  it("keeps loaded users when a later refetch fails", async () => {
    const client = renderSelect();
    await screen.findByRole("option", { name: "Ana (7)" });

    userList = () => Response.json({}, { status: 500 });
    await client.refetchQueries();
    await waitFor(() => expect(client.isFetching()).toBe(0));

    expect(screen.getByRole("option", { name: "Ana (7)" })).toBeTruthy();
    expect(screen.queryByText("Failed to load users")).toBeNull();
  });
});
