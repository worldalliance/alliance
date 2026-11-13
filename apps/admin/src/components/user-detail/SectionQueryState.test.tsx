import { render, screen } from "@testing-library/react";
import { SectionRefreshError } from "./SectionQueryState";

it("announces a failed refresh in a status region that was already there", () => {
  const { rerender } = render(
    <SectionRefreshError noun="friends" isError={false} />,
  );
  const status = screen.getByRole("status");
  expect(status.textContent).toBe("");

  rerender(<SectionRefreshError noun="friends" isError />);

  expect(screen.getByRole("status")).toBe(status);
  expect(status.textContent).toBe(
    "Could not refresh friends. Reload to see the latest.",
  );
});
