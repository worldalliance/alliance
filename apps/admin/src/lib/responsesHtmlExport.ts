import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { exportScript, STYLES } from "./responsesHtmlExport/assets";
import { renderResponse } from "./responsesHtmlExport/responses";
import {
  parseStoredSchema,
  questionFieldsOf,
  renderSchema,
} from "./responsesHtmlExport/schema";
import { escapeXml, tag } from "./responsesHtmlExport/xml";

type ExportForm = {
  id: number;
  title: string;
  formSnapshotId: number;
  schema: unknown;
};

type ExportVariant = { formId: number; name: string };

export type BuildResponsesHtmlParams = {
  title: string;
  form: ExportForm;
  responses: FormResponseDto[];
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
  variantOptions?: ExportVariant[];
  exportedAt: string;
  csvFileName: string;
};

type SnapshotGroup = {
  snapshotId: number;
  schema: unknown;
  current: boolean;
  firstAt: number;
  responses: FormResponseDto[];
};

const submittedAt = (response: FormResponseDto): number =>
  new Date(response.createdAt).getTime();

const groupSnapshots = (params: {
  responses: FormResponseDto[];
  currentSchema: unknown;
  currentSnapshotId: number | null;
}): SnapshotGroup[] => {
  const { responses, currentSchema, currentSnapshotId } = params;
  const groups = new Map<number, SnapshotGroup>();
  for (const response of responses) {
    const existing = groups.get(response.formSnapshotId);
    if (existing) {
      existing.responses.push(response);
      continue;
    }
    groups.set(response.formSnapshotId, {
      snapshotId: response.formSnapshotId,
      schema: response.schemaSnapshot,
      current: response.formSnapshotId === currentSnapshotId,
      firstAt: submittedAt(response),
      responses: [response],
    });
  }
  const ordered = [...groups.values()];
  for (const group of ordered) {
    group.responses.sort((a, b) => submittedAt(a) - submittedAt(b));
    group.firstAt = Math.min(...group.responses.map(submittedAt));
  }
  ordered.sort((a, b) => a.firstAt - b.firstAt);
  if (currentSnapshotId !== null && !groups.has(currentSnapshotId)) {
    ordered.push({
      snapshotId: currentSnapshotId,
      schema: currentSchema,
      current: true,
      firstAt: Number.POSITIVE_INFINITY,
      responses: [],
    });
  }
  return ordered;
};

const renderSnapshot = (params: {
  group: SnapshotGroup;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
}): string => {
  const { group, withdrawnUserMap, sidsToUserMap } = params;
  const pages = parseStoredSchema(group.schema);
  const fields = questionFieldsOf(pages);
  return tag(
    "snapshot",
    [
      ["id", group.snapshotId],
      ["current", group.current ? "true" : "false"],
      ["response-count", group.responses.length],
    ],
    renderSchema(pages) +
      tag(
        "responses",
        [],
        group.responses
          .map((response) =>
            renderResponse({
              response,
              fields,
              withdrawnUserMap,
              sidsToUserMap,
            }),
          )
          .join(""),
      ),
  );
};

export function buildResponsesHtml(params: BuildResponsesHtmlParams): string {
  const {
    title,
    form,
    responses,
    withdrawnUserMap,
    sidsToUserMap,
    variantOptions,
    exportedAt,
    csvFileName,
  } = params;

  const sorted = [...responses].sort((a, b) => submittedAt(a) - submittedAt(b));

  const renderGroups = (groups: SnapshotGroup[]): string =>
    groups
      .map((group) =>
        renderSnapshot({ group, withdrawnUserMap, sidsToUserMap }),
      )
      .join("");

  let snapshotCount = 0;
  let bodyContent: string;

  if (variantOptions && variantOptions.length > 0) {
    const byFormId = new Map<number, FormResponseDto[]>();
    for (const response of sorted) {
      const bucket = byFormId.get(response.formId);
      if (bucket) bucket.push(response);
      else byFormId.set(response.formId, [response]);
    }
    const named = new Map(
      variantOptions.map((option) => [option.formId, option.name]),
    );
    const formIds = [
      ...variantOptions.map((option) => option.formId),
      ...[...byFormId.keys()].filter((formId) => !named.has(formId)),
    ];
    bodyContent = formIds
      .map((formId) => {
        const groups = groupSnapshots({
          responses: byFormId.get(formId) ?? [],
          currentSchema: form.schema,
          currentSnapshotId: formId === form.id ? form.formSnapshotId : null,
        });
        snapshotCount += groups.length;
        return tag(
          "variant",
          [
            ["form-id", formId],
            ["name", named.get(formId) ?? `form ${formId}`],
          ],
          renderGroups(groups),
        );
      })
      .join("");
  } else {
    const groups = groupSnapshots({
      responses: sorted,
      currentSchema: form.schema,
      currentSnapshotId: form.formSnapshotId,
    });
    snapshotCount = groups.length;
    bodyContent = renderGroups(groups);
  }

  const meta = tag(
    "export-meta",
    [],
    tag("exported-at", [], escapeXml(exportedAt)) +
      tag("response-count", [], String(sorted.length)) +
      tag("snapshot-count", [], String(snapshotCount)) +
      tag("first-response-at", [], escapeXml(sorted[0]?.createdAt ?? "")) +
      tag(
        "last-response-at",
        [],
        escapeXml(sorted[sorted.length - 1]?.createdAt ?? ""),
      ),
  );

  const root = tag(
    "form-export",
    [
      ["form-id", form.id],
      ["title", title],
    ],
    meta + bodyContent,
  );

  const toolbar = tag(
    "toolbar",
    [],
    `<span class="name">${escapeXml(title)}</span>` +
      `<button type="button" id="mode-toggle">Showing raw values</button>` +
      `<button type="button" class="primary" id="download-csv">Download CSV</button>`,
  );

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeXml(title)}</title>`,
    `<style>${STYLES}</style>`,
    "</head>",
    '<body class="mode-raw">',
    toolbar,
    root,
    `<script>${exportScript(csvFileName)}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
