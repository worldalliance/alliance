import { render, screen } from "@testing-library/react";
import { ProgressTrack, ProgressTrackSize } from "./ProgressTrack";

const widths = (track: HTMLElement) =>
  Array.from(
    track.querySelectorAll<HTMLElement>(":scope > div"),
    (segment) => segment.style.width,
  );

test("caps each segment at what the earlier ones leave of the goal", () => {
  render(
    <ProgressTrack
      goal={100}
      segments={[
        { count: 70, className: "a" },
        { count: 50, className: "b" },
      ]}
      size={ProgressTrackSize.Page}
      label="70 of 100"
    />,
  );
  expect(widths(screen.getByRole("img", { name: "70 of 100" }))).toEqual([
    "70%",
    "30%",
  ]);
});

test("hides an unlabeled track from assistive technology", () => {
  const { container } = render(
    <ProgressTrack
      goal={10}
      segments={[{ count: 4, className: "a" }]}
      size={ProgressTrackSize.Card}
    />,
  );
  expect(screen.queryByRole("img")).toBeNull();
  const track = container.firstElementChild as HTMLElement;
  expect(track.getAttribute("aria-hidden")).toBe("true");
  expect(widths(track)).toEqual(["40%"]);
});
