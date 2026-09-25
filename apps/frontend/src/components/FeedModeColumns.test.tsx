import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import FeedModeColumns, { FeedMode } from "./FeedModeColumns";

afterEach(cleanup);

const COLUMN_HEIGHT: Record<FeedMode, number> = {
  [FeedMode.Friends]: 120,
  [FeedMode.Everyone]: 480,
};

const realOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetHeight",
);

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return Number(
        this.querySelector("[data-height]")?.getAttribute("data-height") ?? 0,
      );
    },
  });
});

afterAll(() => {
  if (realOffsetHeight) {
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetHeight",
      realOffsetHeight,
    );
  }
});

const renderColumns = () =>
  render(
    <FeedModeColumns
      renderColumn={(mode) => (
        <p data-height={COLUMN_HEIGHT[mode]}>{`${mode} column`}</p>
      )}
      trailing={<a href="/members">Member list</a>}
    />,
  );

const track = () =>
  screen
    .getByText("friends column")
    .closest<HTMLElement>('[style*="transform"]');

const slideOffset = () => track()?.style.transform;

const viewportHeight = () => track()?.parentElement?.style.height;

describe("FeedModeColumns", () => {
  it("renders a column per mode beside the trailing content, showing friends first", () => {
    renderColumns();

    expect(screen.getByText("friends column")).toBeTruthy();
    expect(screen.getByText("everyone column")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Member list" })).toBeTruthy();
    expect(slideOffset()).toBe("translateX(0%)");
  });

  it("slides to the tab that was clicked", () => {
    renderColumns();

    fireEvent.click(screen.getByRole("button", { name: FeedMode.Everyone }));
    expect(slideOffset()).toBe("translateX(-50%)");

    fireEvent.click(screen.getByRole("button", { name: FeedMode.Friends }));
    expect(slideOffset()).toBe("translateX(0%)");
  });

  it("sizes the viewport to the active column", async () => {
    renderColumns();
    await waitFor(() => expect(viewportHeight()).toBe("120px"));

    fireEvent.click(screen.getByRole("button", { name: FeedMode.Everyone }));
    await waitFor(() => expect(viewportHeight()).toBe("480px"));
  });
});
