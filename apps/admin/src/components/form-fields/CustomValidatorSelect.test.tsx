import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { CustomValidatorSelect } from "./CustomValidatorSelect";

afterEach(cleanup);

const listsAnaAndBen = () =>
  Response.json([
    makeUser({ id: 7, name: "Ana", hasActiveContract: true }),
    makeUser({ id: 8, name: "Ben", hasActiveContract: false }),
  ]);
let userList = listsAnaAndBen;

const anaPasses = () =>
  Response.json({
    passCount: 1,
    failCount: 0,
    totalCount: 1,
    passUsers: [{ id: 7, name: "Ana", anonymous: false }],
    failUsers: [],
    selectedUserResult: true,
  });
let expressionResult = anaPasses;

afterEach(() => {
  userList = listsAnaAndBen;
  expressionResult = anaPasses;
});

serveApi(
  routes({
    "GET /tasks/customValidators": () => Response.json([]),
    "GET /user/list": () => userList(),
    "POST /tasks/testCustomExpression": () => expressionResult(),
  }),
);

const renderSelect = ({
  expression = "",
  onChange = () => {},
}: {
  expression?: string;
  onChange?: ComponentProps<typeof CustomValidatorSelect>["onChange"];
} = {}) => {
  const query = queryWrapper();
  render(
    <CustomValidatorSelect
      type="CustomExpression"
      idArgument={null}
      expression={expression}
      onChange={onChange}
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

describe("the custom expression editor", () => {
  it("reports an edited expression under the expression validator", () => {
    const changes: unknown[] = [];
    renderSelect({ onChange: (change) => changes.push(change) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "true" },
    });

    expect(changes).toEqual([
      {
        validatorType: "CustomExpression",
        idArgument: null,
        expression: "true",
      },
    ]);
  });

  it("shows the selected user's result and the totals", async () => {
    renderSelect({ expression: "true" });
    await screen.findByRole("option", { name: "Ana (7)" });

    fireEvent.click(screen.getByRole("button", { name: "Test expression" }));

    expect(await screen.findByText("Ana (7): true")).toBeTruthy();
    expect(
      screen.getByText("Active-contract users: 1 pass, 0 fail (total 1)"),
    ).toBeTruthy();
  });

  it("shows why the expression failed to run", async () => {
    expressionResult = () =>
      Response.json(
        { message: "Unknown identifier: foo", statusCode: 400 },
        { status: 400 },
      );
    renderSelect({ expression: "foo" });
    await screen.findByRole("option", { name: "Ana (7)" });

    fireEvent.click(screen.getByRole("button", { name: "Test expression" }));

    expect(await screen.findByText("Unknown identifier: foo")).toBeTruthy();
    expect(screen.queryByText(/Active-contract users:/)).toBeNull();
  });
});
