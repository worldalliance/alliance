import type { FormSchema } from "@alliance/common/forms/form-schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { AggregateBuilder } from "./AggregateBuilder";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "people", type: "input", kind: "number", label: "People" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [
    {
      id: "v1",
      kind: "progressbar",
      title: "Signed",
      caption: "Progress:",
      numerator: { type: "number", value: 3 },
      denominator: { type: "number", value: 100 },
      displayType: "number",
    },
  ],
};

function mount() {
  const saved: FormSchema[] = [];
  function Harness() {
    const [current, setCurrent] = useState(schema);
    return (
      <AggregateBuilder
        schema={current}
        onSchemaChange={(next) => {
          saved.push(next);
          setCurrent(next);
        }}
      />
    );
  }
  render(<Harness />);
  return () => saved.at(-1)?.aggregateViews;
}

describe("AggregateBuilder", () => {
  it("lists each view as a section and adds one starting on the first number question", () => {
    const views = mount();
    fireEvent.click(screen.getByRole("button", { name: "Add aggregate view" }));

    expect(screen.getByRole("region", { name: "View 2" })).toBeTruthy();
    expect(views()?.[1]).toMatchObject({
      numerator: { type: "numberfield", fieldId: "people" },
      denominator: { type: "number", value: 100 },
    });
  });

  it("commits a typed static number on blur", () => {
    const views = mount();
    const input = screen.getByLabelText("Numerator value");
    fireEvent.change(input, { target: { value: "12" } });
    expect(views()).toBeUndefined();
    fireEvent.blur(input);

    expect(views()?.[0].numerator).toEqual({ type: "number", value: 12 });
  });

  it("switches a value to a number question and back", () => {
    const views = mount();
    fireEvent.click(screen.getAllByLabelText("Number question")[1]);
    expect(views()?.[0].denominator).toEqual({
      type: "numberfield",
      fieldId: "people",
    });
    fireEvent.click(screen.getAllByLabelText("Static number")[1]);
    expect(views()?.[0].denominator).toEqual({ type: "number", value: 0 });
  });

  it("removes a view", () => {
    const views = mount();
    fireEvent.click(screen.getByRole("button", { name: "Remove view" }));

    expect(views()).toEqual([]);
  });
});
