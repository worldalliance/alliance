import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
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

const response: FormResponseDto = {
  id: 1,
  formId: 1,
  formSnapshotId: 7,
  answers: { pick: ["b", "a"] },
  publicAnswers: {},
  createdAt: "2026-03-04T10:00:00.000Z",
  schemaSnapshot: SCHEMA,
  phDistinctId: null,
  deviceType: null,
  sessionReplayUrl: null,
  sid: null,
  visibilityValidatorResults: {},
  formulaChoices: {
    pick: [
      { label: "Alpha", value: "a" },
      { label: "Beta", value: "b" },
    ],
  },
};

it("labels a formula field's answer with the choices its response saved", () => {
  const fields = collectSnapshotFields({
    currentSchema: SCHEMA,
    currentSnapshotId: 7,
    responses: [response],
  });
  const columns = buildTableColumns({
    questions: buildQuestionColumns({ fields, mode: SnapshotMode.Focused }),
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
