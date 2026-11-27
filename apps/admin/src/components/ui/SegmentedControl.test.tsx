import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, mock } from "bun:test";
import SegmentedControl from "./SegmentedControl";

it("offers labelled choices with the current one checked", () => {
  const onChange = mock();
  render(
    <SegmentedControl
      label="View"
      options={[
        { value: "list", label: "List" },
        { value: "timeline", label: "Timeline" },
      ]}
      value="list"
      onChange={onChange}
    />,
  );

  expect(screen.getByRole("radiogroup", { name: "View" })).toBeTruthy();
  expect(
    screen.getByRole<HTMLInputElement>("radio", { name: "List" }).checked,
  ).toBe(true);

  fireEvent.click(screen.getByRole("radio", { name: "Timeline" }));

  expect(onChange).toHaveBeenCalledWith("timeline");
});
