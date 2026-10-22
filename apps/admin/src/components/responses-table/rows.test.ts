import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { assignedRowFields } from "../../lib/assignedRowFields";
import {
  buildQuestionColumns,
  collectSnapshotFields,
  SnapshotMode,
} from "./columns";
import { buildRows, buildTableColumns } from "./rows";

const SCHEMA: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "pick",
          type: "input",
          kind: "multiselect",
          label: "Pick",
          options: [],
          optionsFormula: { inputs: {}, formula: "[]" },
        },
      ],
    },
  ],
  outputViews: [],
};

const response = makeFormResponse({
  formSnapshotId: 7,
  answers: { pick: ["b", "a"] },
  createdAt: "2026-03-04T10:00:00.000Z",
  schemaSnapshot: SCHEMA,
  formulaChoices: {
    pick: [
      { label: "Alpha", value: "a" },
      { label: "Beta", value: "b" },
    ],
  },
});

it("labels a formula field's answer with the choices its response saved", () => {
  const fields = collectSnapshotFields({
    currentSchema: SCHEMA,
    currentSnapshotId: 7,
    responses: [response],
  });
  const columns = buildTableColumns({
    questions: buildQuestionColumns({ fields, mode: SnapshotMode.Focused }),
    rowFields: [],
    hasVariants: false,
  });
  const [row] = buildRows({
    responses: [response],
    columns,
    fieldsBySnapshot: new Map<number, Map<string, AnyField>>(
      [...fields.bySnapshotId].map(([snapshotId, list]) => [
        snapshotId,
        new Map(list.map((field) => [field.id, field])),
      ]),
    ),
    sidsToUserMap: {},
    withdrawnUserMap: new Map(),
    variantByFormId: new Map(),
  });
  const pickColumn = columns.find((column) => column.label === "Pick");

  expect(pickColumn && row.cells[pickColumn.id]?.text).toBe("Beta, Alpha");
});

it("shows each response's row values in their own columns", () => {
  const withRow = makeFormResponse({
    id: 2,
    assignedRow: {
      key: '["Springfield"]',
      values: { jurisdiction: "Springfield" },
    },
  });
  const columns = buildTableColumns({
    questions: [],
    rowFields: assignedRowFields([withRow, response]),
    hasVariants: false,
  });
  const rows = buildRows({
    responses: [withRow, response],
    columns,
    fieldsBySnapshot: new Map(),
    sidsToUserMap: {},
    withdrawnUserMap: new Map(),
    variantByFormId: new Map(),
  });

  expect(columns.map(({ label }) => label)).toContain("row.jurisdiction");
  expect(rows.map((row) => row.cells["row.jurisdiction"].text)).toEqual([
    "Springfield",
    "",
  ]);
});
