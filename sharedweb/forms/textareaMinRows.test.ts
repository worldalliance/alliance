import { textareaMinRows } from "./textareaMinRows";

it.each([
  { case: "editable", disabled: false, isPreview: false, expected: 8 },
  { case: "read-only answer", disabled: true, isPreview: false, expected: 1 },
  { case: "builder preview", disabled: true, isPreview: true, expected: 8 },
])(
  "gives the $case textarea $expected rows",
  ({ disabled, isPreview, expected }) => {
    expect(textareaMinRows({ rows: 8, disabled, isPreview })).toBe(expected);
  },
);

it("defaults to 3 rows", () => {
  expect(textareaMinRows({ disabled: false, isPreview: false })).toBe(3);
});
