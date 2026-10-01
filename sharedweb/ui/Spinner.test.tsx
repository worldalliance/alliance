import { cleanup, render, screen } from "@testing-library/react";
import Spinner from "./Spinner";

afterEach(cleanup);

it("names its status for screen readers", () => {
  render(<Spinner />);
  expect(screen.getByRole("status", { name: "Loading..." })).toBeTruthy();
});
