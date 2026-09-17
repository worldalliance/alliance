import type { AnyField } from "@alliance/common/forms/form-schema";
import type { FormResponseDto, ProfileDto } from "@alliance/shared/client";
import {
  buildQuestionColumns,
  collectSnapshotFields,
  SnapshotMode,
} from "./columns";
import { buildRows, buildTableColumns } from "./rows";
import { highlightSegments, matchesQuery } from "./search";
import { MetaColumnId } from "./types";

const SCHEMA = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "fruit",
          type: "input",
          kind: "select",
          label: "Favourite fruit",
          options: [
            { value: "opt-1", label: "Bananas" },
            { value: "opt-2", label: "Apricots" },
          ],
        },
        {
          id: "note",
          type: "input",
          kind: "textarea",
          label: "Anything else?",
        },
      ],
    },
  ],
  outputViews: [],
};

const INVITER: ProfileDto = {
  id: 99,
  admin: false,
  staff: false,
  ambassador: false,
  profilePicture: null,
  profileDescription: null,
  anonymous: false,
  displayName: "Esha Gupta",
  hasActiveContract: false,
  isCommunityLeader: false,
};

const SIDS_TO_USER: Record<string, ProfileDto> = { "sid-1": INVITER };

const response = (params: {
  id: number;
  answers: Record<string, unknown>;
  sid?: string;
}): FormResponseDto => ({
  id: params.id,
  formId: 1,
  formSnapshotId: 7,
  answers: params.answers,
  publicAnswers: {},
  createdAt: "2026-03-04T10:00:00.000Z",
  schemaSnapshot: SCHEMA,
  visibilityValidatorResults: {},
  sid: params.sid,
});

const buildTestRows = (responses: FormResponseDto[]) => {
  const fields = collectSnapshotFields({
    currentSchema: SCHEMA,
    currentSnapshotId: 7,
    responses,
  });
  const columns = buildTableColumns({
    questions: buildQuestionColumns({ fields, mode: SnapshotMode.Focused }),
    hasVariants: false,
  });
  const fieldsBySnapshot = new Map<number, Map<string, AnyField>>(
    [...fields.bySnapshotId].map(([snapshotId, list]) => [
      snapshotId,
      new Map(list.map((field) => [field.id, field])),
    ]),
  );
  return {
    columns,
    rows: buildRows({
      responses,
      columns,
      fieldsBySnapshot,
      sidsToUserMap: SIDS_TO_USER,
      withdrawnUserMap: new Map(),
      variantByFormId: new Map(),
    }),
  };
};

const textsFor = (params: {
  row: { cells: Record<string, { text: string }> };
  columnIds: string[];
}) => params.columnIds.map((id) => params.row.cells[id]?.text ?? "");

describe("matchesQuery", () => {
  it("matches the option label a cell shows, not the stored value", () => {
    const { columns, rows } = buildTestRows([
      response({ id: 1, answers: { fruit: "opt-1" }, sid: "sid-1" }),
    ]);
    const columnIds = columns.map((column) => column.id);
    const texts = textsFor({ row: rows[0], columnIds });

    expect(matchesQuery({ texts, query: "banan" })).toBe(true);
    expect(matchesQuery({ texts, query: "opt-1" })).toBe(false);
  });

  it("ignores case", () => {
    const { columns, rows } = buildTestRows([
      response({ id: 1, answers: { note: "Nothing To Add" } }),
    ]);
    const texts = textsFor({
      row: rows[0],
      columnIds: columns.map((column) => column.id),
    });

    expect(matchesQuery({ texts, query: "nothing to add" })).toBe(true);
  });

  it("does not search a column that is hidden", () => {
    const { rows } = buildTestRows([
      response({ id: 1, answers: { note: "secret" }, sid: "sid-1" }),
    ]);
    const visibleIds = [MetaColumnId.Respondent, MetaColumnId.Submitted];

    expect(
      matchesQuery({
        texts: textsFor({ row: rows[0], columnIds: visibleIds }),
        query: "secret",
      }),
    ).toBe(false);
    expect(
      matchesQuery({
        texts: textsFor({ row: rows[0], columnIds: visibleIds }),
        query: "esha gupta",
      }),
    ).toBe(true);
  });

  it("matches the respondent name the table renders for an anonymous response", () => {
    const { rows } = buildTestRows([response({ id: 1, answers: {} })]);

    expect(rows[0].cells[MetaColumnId.Respondent].text).toBe("anonymous");
  });

  it("matches everything while the box is empty", () => {
    expect(matchesQuery({ texts: ["anything"], query: "  " })).toBe(true);
  });
});

describe("highlightSegments", () => {
  it("marks every occurrence and keeps the original casing", () => {
    expect(highlightSegments({ text: "Banana bandana", query: "ban" })).toEqual(
      [
        { text: "Ban", match: true },
        { text: "ana ", match: false },
        { text: "ban", match: true },
        { text: "dana", match: false },
      ],
    );
  });

  it("leaves the text whole when nothing is typed", () => {
    expect(highlightSegments({ text: "Bananas", query: "" })).toEqual([
      { text: "Bananas", match: false },
    ]);
  });

  it("leaves the text whole when nothing matches", () => {
    expect(highlightSegments({ text: "Bananas", query: "zz" })).toEqual([
      { text: "Bananas", match: false },
    ]);
  });
});
