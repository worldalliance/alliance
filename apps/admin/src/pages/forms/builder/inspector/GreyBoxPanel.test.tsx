import type { PageItem } from "@alliance/common/forms/form-schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { GreyBoxPanel } from "./GreyBoxPanel";

const el = (id: string, group?: string): PageItem => ({
  id,
  type: "display",
  kind: "label",
  text: id,
  ...(group === undefined ? {} : { group }),
});

const renderPanel = (
  fields: PageItem[],
  { start, end }: { start: number; end: number },
) => {
  const onChange = jest.fn();
  const onSelectBox = jest.fn();
  render(
    <GreyBoxPanel
      fields={fields}
      start={start}
      end={end}
      onChange={onChange}
      onSelectBox={onSelectBox}
    />,
  );
  return { onChange, onSelectBox };
};

const button = (name: string) => screen.getByRole("button", { name });

it("puts ungrouped elements in a grey box", () => {
  const { onChange } = renderPanel([el("a"), el("b")], { start: 0, end: 2 });
  expect(screen.getByText("Not in a grey box.")).toBeTruthy();

  fireEvent.click(button("Put in a grey box"));

  const [fields] = onChange.mock.calls[0]!;
  expect(fields[0].group).toBeDefined();
  expect(fields[1].group).toBe(fields[0].group);
});

it("removes a grey box selected whole", () => {
  const { onChange } = renderPanel([el("a", "g"), el("b", "g")], {
    start: 0,
    end: 2,
  });
  expect(screen.getByText("In a grey box with 2 elements.")).toBeTruthy();

  fireEvent.click(button("Remove grey box"));

  expect(onChange.mock.calls[0]![0].map((e: PageItem) => e.group)).toEqual([
    undefined,
    undefined,
  ]);
});

it("selects or leaves the grey box a member is in", () => {
  const { onChange, onSelectBox } = renderPanel(
    [el("a", "g"), el("b", "g"), el("c")],
    { start: 1, end: 2 },
  );
  expect(screen.getByText("In a grey box with 2 elements.")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Put in a grey box" }),
  ).toBeNull();

  fireEvent.click(button("Select grey box"));
  expect(onSelectBox).toHaveBeenCalledWith(
    expect.objectContaining({ start: 0, end: 2 }),
  );

  fireEvent.click(button("Remove from grey box"));
  expect(onChange.mock.calls[0]![0].map((e: PageItem) => e.group)).toEqual([
    "g",
    undefined,
    undefined,
  ]);
});
