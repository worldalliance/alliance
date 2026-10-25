import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, jest } from "bun:test";
import GlobalFeed from "./GlobalFeed";

it("offers a retry instead of an empty feed when the feed fails to load", () => {
  const onRetry = jest.fn();
  render(<GlobalFeed items={[]} failure={{ onRetry, retrying: false }} />);

  expect(screen.queryByText("No recent activity")).toBeNull();
  expect(screen.getByText("Couldn't load recent activity.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
