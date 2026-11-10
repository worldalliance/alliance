import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { CustomValidatorSelect } from "./CustomValidatorSelect";

const noValidatorTypes = () => Response.json([]);
let validatorTypes = noValidatorTypes;

afterEach(() => {
  validatorTypes = noValidatorTypes;
});

serveApi(
  routes({
    "GET /tasks/customValidators": () => validatorTypes(),
  }),
);

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
    <CustomValidatorSelect idArgument={null} onChange={() => {}} />
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
