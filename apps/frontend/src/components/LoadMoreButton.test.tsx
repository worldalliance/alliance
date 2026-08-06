import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LoadMoreButton from "./LoadMoreButton";

afterEach(cleanup);

describe("LoadMoreButton", () => {
  it("asks for the next page when pressed", () => {
    const onClick = jest.fn();
    render(<LoadMoreButton onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows no spinner while idle", () => {
    render(<LoadMoreButton onClick={() => {}} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  describe("while loading", () => {
    // Queried without a name: the spinner contributes its own "Loading…" to the
    // button's accessible name, so it is not "Load more" in this state.
    it("disables itself, so the page can't be asked for twice", () => {
      render(<LoadMoreButton onClick={() => {}} loading />);

      expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    });

    it("says so with a spinner", () => {
      render(<LoadMoreButton onClick={() => {}} loading />);

      expect(screen.getByRole("status")).toBeTruthy();
    });
  });
});
