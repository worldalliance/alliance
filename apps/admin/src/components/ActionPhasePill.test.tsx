import { render, screen } from "@testing-library/react";
import { ActionPhase } from "../lib/actionPhase";
import ActionPhasePill from "./ActionPhasePill";

it("names an open action's phase", () => {
  render(<ActionPhasePill phase={ActionPhase.StaffTesting} status="draft" />);
  expect(screen.getByText("Staff testing")).toBeTruthy();
});

it("names how a closed action ended, in the status words", () => {
  render(<ActionPhasePill phase={ActionPhase.Closed} status="failed" />);
  expect(screen.getByText("Failed")).toBeTruthy();
});
