import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { MultiFilter } from "./MultiFilter";

afterEach(cleanup);

const options = [
  { value: "a", label: "Alpha", memberCount: 3 },
  { value: "b", label: "Beta", memberCount: undefined },
];

describe("MultiFilter", () => {
  it("summarises the picks on its button", () => {
    const props = { title: "Tags", noun: "tag", options, emptyText: "None" };
    const { rerender } = render(
      <MultiFilter {...props} selected={[]} onChange={() => {}} />,
    );
    screen.getByRole("button", { name: "Tags: All tags" });
    rerender(<MultiFilter {...props} selected={["a"]} onChange={() => {}} />);
    screen.getByRole("button", { name: "Tags: Alpha" });
    rerender(
      <MultiFilter {...props} selected={["a", "b"]} onChange={() => {}} />,
    );
    screen.getByRole("button", { name: "Tags: 2 tags" });
  });

  it("toggles options and clears", async () => {
    const onChange = jest.fn();
    render(
      <MultiFilter
        title="Tags"
        noun="tag"
        options={options}
        selected={["a"]}
        onChange={onChange}
        emptyText="None"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tags: Alpha" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Beta/ }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("says so when there are no options", async () => {
    render(
      <MultiFilter
        title="Tags"
        noun="tag"
        options={[]}
        selected={[]}
        onChange={() => {}}
        emptyText="No tags yet."
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tags: All tags" }));
    await screen.findByText("No tags yet.");
  });
});
