import { cleanup, render, screen } from "@testing-library/react";
import { WithdrawalDetails } from "./WithdrawalInfo";

afterEach(cleanup);

test("shows the chosen option's label, then the typed reason", () => {
  const { container } = render(
    <WithdrawalDetails
      withdrawal={{ outOfTime: true, isMoral: false, declineReason: "busy" }}
    />,
  );

  expect(
    Array.from(container.querySelectorAll("span"), (span) => span.textContent),
  ).toEqual(["Took more than 15 minutes", "busy"]);
});

test("labels a withdrawal stored without flags or a reason", () => {
  render(
    <WithdrawalDetails
      withdrawal={{ outOfTime: null, isMoral: null, declineReason: null }}
    />,
  );

  expect(screen.getByText("Other reason")).toBeTruthy();
});
