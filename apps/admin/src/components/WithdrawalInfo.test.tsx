import { render, screen } from "@testing-library/react";
import { WithdrawalDetails, WithdrawalInfo } from "./WithdrawalInfo";

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

test("the badge takes focus and names the reason for screen readers", () => {
  render(
    <WithdrawalInfo
      withdrawal={{ outOfTime: true, isMoral: false, declineReason: "busy" }}
    />,
  );

  const trigger = screen.getByText("Withdrew").closest("[tabindex='0']");
  expect(trigger).not.toBeNull();
  expect(trigger?.textContent).toContain("Took more than 15 minutes: busy");
});
