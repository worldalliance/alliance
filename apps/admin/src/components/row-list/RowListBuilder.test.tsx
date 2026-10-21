import type { FormSchema } from "@alliance/common/forms/form-schema";
import { RowConditionKind } from "@alliance/common/forms/row-list-schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { RowListBuilder } from "./RowListBuilder";

afterEach(cleanup);

const base: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "intro", type: "display", kind: "text", text: "Hello" },
        { id: "sentTo", type: "input", kind: "email", label: "Emailed to" },
      ],
    },
  ],
  outputViews: [],
};

const ROWS = [
  { jurisdiction: "Springfield", type: "City", email: null },
  { jurisdiction: "Springfield", type: "County", email: "records@example.gov" },
];

function Harness({ onSave }: { onSave: (schema: FormSchema) => void }) {
  const [schema, setSchema] = useState(base);
  return (
    <RowListBuilder
      schema={schema}
      onSchemaChange={(next) => {
        setSchema(next);
        onSave(next);
      }}
    />
  );
}

const mount = () => {
  const saved: FormSchema[] = [];
  render(<Harness onSave={(next) => saved.push(next)} />);
  return { latest: () => saved.at(-1) };
};

const pasteRows = (text: string) => {
  fireEvent.change(screen.getByLabelText("Rows as JSON"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByText("Use these rows"));
};

it("takes pasted rows, then the fields that identify one", () => {
  const { latest } = mount();
  pasteRows(JSON.stringify(ROWS));
  expect(latest()?.rowList).toEqual({ rows: ROWS, keyFields: [] });
  expect(screen.getByText("2 rows")).toBeTruthy();

  fireEvent.click(screen.getByLabelText("jurisdiction"));
  fireEvent.click(screen.getByLabelText("type"));
  expect(latest()?.rowList?.keyFields).toEqual(["jurisdiction", "type"]);
});

it("explains JSON it can't use and keeps the form as it was", () => {
  const { latest } = mount();
  pasteRows("[{ nope");
  expect(screen.getByText(/^Not valid JSON/)).toBeTruthy();
  pasteRows('[{ "nested": { "a": 1 } }]');
  expect(screen.getByText(/^Paste an array of objects/)).toBeTruthy();
  expect(latest()).toBeUndefined();
});

it("shows an item only for rows with a value picked from the list", () => {
  const { latest } = mount();
  pasteRows(JSON.stringify(ROWS));

  fireEvent.change(
    screen.getByLabelText(/Row field that decides whether .*Emailed to/),
    { target: { value: "type" } },
  );
  fireEvent.change(screen.getByLabelText(/Comparison for .*Emailed to/), {
    target: { value: RowConditionKind.Equals },
  });
  fireEvent.change(screen.getByLabelText(/Value for .*Emailed to/), {
    target: { value: JSON.stringify("County") },
  });

  const sentTo = latest()?.pages[0].fields[1];
  expect(sentTo?.rowCondition).toEqual({
    kind: RowConditionKind.Equals,
    field: "type",
    value: "County",
  });
});

it("removes the list on request", () => {
  const { latest } = mount();
  pasteRows(JSON.stringify(ROWS));
  fireEvent.click(screen.getByText("Remove the row list"));
  expect(latest()?.rowList).toBeUndefined();
  expect(screen.queryByText("Fields that identify a row")).toBeNull();
});

it("shows an item for any of several picked values", () => {
  const { latest } = mount();
  pasteRows(JSON.stringify(ROWS));

  fireEvent.change(
    screen.getByLabelText(/Row field that decides whether .*Hello/),
    { target: { value: "email" } },
  );
  fireEvent.change(screen.getByLabelText(/Comparison for .*Hello/), {
    target: { value: RowConditionKind.IsOneOf },
  });
  fireEvent.click(screen.getByLabelText("records@example.gov"));

  expect(latest()?.pages[0].fields[0].rowCondition).toEqual({
    kind: RowConditionKind.IsOneOf,
    field: "email",
    values: [null, "records@example.gov"],
  });

  fireEvent.click(screen.getByLabelText("(empty)"));
  expect(latest()?.pages[0].fields[0].rowCondition).toEqual({
    kind: RowConditionKind.IsOneOf,
    field: "email",
    values: ["records@example.gov"],
  });
});
