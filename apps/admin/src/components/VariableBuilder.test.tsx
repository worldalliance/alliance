import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { VariableBuilder } from "./VariableBuilder";

afterEach(cleanup);

const people: AnyField = {
  id: "people",
  type: "input",
  kind: "list",
  label: "People",
  fields: [
    { id: "n", type: "input", kind: "text", label: "Name" },
    { id: "a", type: "input", kind: "number", label: "Age" },
    { id: "f", type: "input", kind: "file", label: "Photo" },
  ],
};

const town: AnyField = {
  id: "town",
  type: "input",
  kind: "text",
  label: "Town",
};

const schema: FormSchema = {
  pages: [{ id: "p1", fields: [people] }],
  outputViews: [],
  variables: [
    {
      name: "names",
      inputs: {
        input1: { kind: "list", fieldId: "people", properties: { n: "who" } },
      },
      formula: "input1.map(p => p.who + (p.age ?? '')).join(', ')",
    },
  ],
};

function Harness({
  initial = schema,
  onSave,
}: {
  initial?: FormSchema;
  onSave: (schema: FormSchema) => void;
}) {
  const [current, setCurrent] = useState(initial);
  return (
    <VariableBuilder
      schema={current}
      onSchemaChange={(next) => {
        setCurrent(next);
        onSave(next);
      }}
    />
  );
}

describe("VariableBuilder list inputs", () => {
  it("names new sub-fields and previews sample rows like a live form", () => {
    const saved: FormSchema[] = [];
    render(<Harness onSave={(next) => saved.push(next)} />);

    expect(
      screen.getByLabelText<HTMLInputElement>("input1 property name for Name")
        .value,
    ).toBe("who");
    expect(
      screen.getByLabelText<HTMLInputElement>("input1 property name for Age")
        .value,
    ).toBe("age");
    expect(
      screen.queryByLabelText("input1 property name for Photo"),
    ).toBeNull();

    const addRow = screen.getByLabelText("Add sample row to input1");
    fireEvent.click(addRow);
    fireEvent.click(addRow);
    fireEvent.change(
      screen.getByLabelText("Sample answer for input1 row 1, Name"),
      { target: { value: "Ada" } },
    );
    fireEvent.change(
      screen.getByLabelText("Sample answer for input1 row 1, Age"),
      { target: { value: "34" } },
    );
    fireEvent.change(
      screen.getByLabelText("Sample answer for input1 row 2, Name"),
      { target: { value: "Lin" } },
    );
    expect(screen.getByText("Ada34, Lin")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Remove sample row 1 of input1"));
    expect(screen.getByText("Lin")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("input1 property name for Name"), {
      target: { value: "full name!" },
    });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "list",
      fieldId: "people",
      properties: { n: "fullname", a: "age" },
    });
  });

  it("shows the property-name errors validation would report", () => {
    render(<Harness onSave={() => {}} />);

    for (const label of ["Name", "Age"]) {
      fireEvent.change(
        screen.getByLabelText(`input1 property name for ${label}`),
        { target: { value: "dup" } },
      );
    }
    fireEvent.change(screen.getByLabelText("input1 property name for Name"), {
      target: { value: "1st" },
    });

    expect(
      screen.getByText(/property "1st" has to start with a letter/),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("input1 property name for Name"), {
      target: { value: "dup" },
    });

    expect(
      screen.getByText(/uses property name "dup" more than once/),
    ).toBeTruthy();
  });

  it("reads a list picked in the field select as a list input", () => {
    const saved: FormSchema[] = [];
    render(
      <Harness
        initial={{
          pages: [{ id: "p1", fields: [town, people] }],
          outputViews: [],
          variables: [
            {
              name: "v",
              inputs: { input1: { kind: "field", fieldId: "town" } },
              formula: "input1",
            },
          ],
        }}
        onSave={(next) => saved.push(next)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Field read by input1"), {
      target: { value: "people" },
    });

    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "list",
      fieldId: "people",
      properties: { n: "name", a: "age" },
    });
  });

  it("marks a list read as one field and converts it when picked", () => {
    const saved: FormSchema[] = [];
    render(
      <Harness
        initial={{
          pages: [{ id: "p1", fields: [people] }],
          outputViews: [],
          variables: [
            {
              name: "v",
              inputs: { input1: { kind: "field", fieldId: "people" } },
              formula: "input1",
            },
          ],
        }}
        onSave={(next) => saved.push(next)}
      />,
    );

    expect(screen.getByText(/Missing or unusable field/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Field read by input1"), {
      target: { value: "people" },
    });

    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "list",
      fieldId: "people",
      properties: { n: "name", a: "age" },
    });
  });

  it("starts a new variable on a list from a joined property", () => {
    const saved: FormSchema[] = [];
    render(
      <Harness
        initial={{ pages: [{ id: "p1", fields: [people] }], outputViews: [] }}
        onSave={(next) => saved.push(next)}
      />,
    );

    fireEvent.click(screen.getByText("Add variable"));

    expect(saved.at(-1)?.variables?.[0].formula).toBe(
      "input1.map(row => row.name).join(', ')",
    );
  });

  it("flags a sample cell that doesn't read as its kind", () => {
    render(<Harness onSave={() => {}} />);

    fireEvent.click(screen.getByLabelText("Add sample row to input1"));
    fireEvent.change(
      screen.getByLabelText("Sample answer for input1 row 1, Age"),
      { target: { value: "abc" } },
    );

    expect(
      screen.getByText(/Row 1, age: "abc" is not a number\./),
    ).toBeTruthy();
  });

  it("builds the help example from a valid property name", () => {
    render(<Harness onSave={() => {}} />);

    fireEvent.change(screen.getByLabelText("input1 property name for Name"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByLabelText("What you can write here"));

    expect(
      screen.getByText("input1.map(row => row.age).join(', ')"),
    ).toBeTruthy();
    expect(screen.queryByText("input1.map(row => row.).join(', ')")).toBeNull();
  });
});
