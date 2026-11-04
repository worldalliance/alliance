import { render, screen } from "@testing-library/react";
import { ParticipantsBar } from "./ParticipantsBar";

const fill = () =>
  screen.getByRole("img").querySelector<HTMLElement>(":scope > div")?.style
    .width;

test("fills the share of the goal reached", () => {
  render(<ParticipantsBar participants={125} goal={500} />);
  expect(fill()).toBe("25%");
  expect(screen.getByText("125 participants")).toBeTruthy();
  expect(screen.getByText("Goal: 500 participants")).toBeTruthy();
});

test("stops at full past the goal", () => {
  render(<ParticipantsBar participants={650} goal={500} />);
  expect(fill()).toBe("100%");
});
