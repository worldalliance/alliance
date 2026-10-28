import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { CustomValidatorSelect } from "./CustomValidatorSelect";

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

const noValidatorTypes = () => Response.json([]);
let validatorTypes = noValidatorTypes;

afterEach(() => {
  userList = listsAnaAndBen;
  expressionResult = anaPasses;
  validatorTypes = noValidatorTypes;
});

serveApi(
  routes({
    "GET /tasks/customValidators": () => validatorTypes(),
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

const hasPhoneNumber = () =>
  Response.json([
    {
      name: "Has phone number",
      id: "HasPhoneNumber",
      withIdField: false,
      usableForVisibility: true,
    },
  ]);

describe("the validator type picker", () => {
  const picker = (
    <CustomValidatorSelect
      idArgument={null}
      expression={null}
      onChange={() => {}}
    />
  );

  it("loads the types once for the session", async () => {
    let loads = 0;
    validatorTypes = () => {
      loads += 1;
      return hasPhoneNumber();
    };
    const query = queryWrapper();
    const view = render(picker, query);
    await screen.findByRole("option", { name: "Has phone number" });
    view.unmount();

    render(picker, query);

    expect(
      screen.getByRole("option", { name: "Has phone number" }),
    ).toBeTruthy();
    expect(loads).toBe(1);
  });

  it("says when the types fail to load, and asks again on the next mount", async () => {
    validatorTypes = () =>
      Response.json(
        { statusCode: 500, message: "Internal server error" },
        { status: 500 },
      );
    const query = queryWrapper();
    const view = render(picker, query);
    expect(await screen.findByText("Failed to load validators")).toBeTruthy();
    view.unmount();

    validatorTypes = hasPhoneNumber;
    render(picker, query);

    expect(
      await screen.findByRole("option", { name: "Has phone number" }),
    ).toBeTruthy();
  });
});

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

  it("drops an earlier result when a later run fails", async () => {
    renderSelect({ expression: "true" });
    await screen.findByRole("option", { name: "Ana (7)" });
    fireEvent.click(screen.getByRole("button", { name: "Test expression" }));
    await screen.findByText("Ana (7): true");

    expressionResult = () => Response.json({}, { status: 500 });
    fireEvent.click(screen.getByRole("button", { name: "Test expression" }));

    expect(await screen.findByText("Expression failed to run.")).toBeTruthy();
    expect(screen.queryByText("Ana (7): true")).toBeNull();
  });

  it("drops the result once the expression is edited", async () => {
    const query = queryWrapper();
    const editor = (expression: string) => (
      <CustomValidatorSelect
        type="CustomExpression"
        idArgument={null}
        expression={expression}
        onChange={() => {}}
      />
    );
    const view = render(editor("true"), query);
    await screen.findByRole("option", { name: "Ana (7)" });
    fireEvent.click(screen.getByRole("button", { name: "Test expression" }));
    await screen.findByText("Ana (7): true");

    view.rerender(editor("false"));
    expect(screen.queryByText("Ana (7): true")).toBeNull();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    view.rerender(editor("true"));
    expect(screen.queryByText("Ana (7): true")).toBeNull();
  });
});
