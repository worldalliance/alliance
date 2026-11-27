import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { downloadBlob } from "@alliance/sharedweb/lib/downloadBlob";
import { buildResponsesCsv } from "../../lib/responsesCsvExport";
import { buildResponsesHtml } from "../../lib/responsesHtmlExport";
import type {
  FormWithSchema,
  ResponseVariantOption,
} from "../FormResponsesView";

const safeFileBase = (exportFileBase: string): string =>
  exportFileBase.replace(/[^a-z0-9-_]+/gi, "-");

/** Downloads `responses` as CSV, with a BOM so spreadsheets read it as UTF-8. */
export function exportResponsesCsv(params: {
  responses: FormResponseDto[];
  orderedFieldIds: string[];
  fieldLabels: Map<string, string>;
  schema: unknown;
  formId: number;
  variantName?: (response: FormResponseDto) => string | null;
  exportFileBase: string;
}): void {
  const csv = buildResponsesCsv({
    responses: params.responses,
    orderedFieldIds: params.orderedFieldIds,
    fieldLabels: params.fieldLabels,
    schema: params.schema,
    formId: params.formId,
    variantName: params.variantName,
  });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${safeFileBase(params.exportFileBase)}-responses.csv`);
}

/** Downloads `responses` as one self-contained HTML file. */
export function exportResponsesHtml(params: {
  title: string;
  form: FormWithSchema;
  responses: FormResponseDto[];
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
  variantOptions?: ResponseVariantOption[];
  filters: string[];
  exportFileBase: string;
}): void {
  const safeTitle = safeFileBase(params.exportFileBase);
  const html = buildResponsesHtml({
    title: params.title,
    form: params.form,
    responses: params.responses,
    withdrawnUserMap: params.withdrawnUserMap,
    sidsToUserMap: params.sidsToUserMap,
    variantOptions: params.variantOptions,
    filters: params.filters,
    exportedAt: new Date().toISOString(),
    csvFileName: `${safeTitle}-responses.csv`,
  });
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  downloadBlob(blob, `${safeTitle}-responses.html`);
}

/** The filters narrowing what the table shows, in words, for the exports to state. */
export function exportFilterDescriptions(params: {
  variantName: string | null;
  query: string;
  snapshotId: number | null;
}): string[] {
  const { variantName, query, snapshotId } = params;
  return [
    ...(variantName ? [`Variant: ${variantName}`] : []),
    ...(query ? [`Search: ${query}`] : []),
    ...(snapshotId !== null ? [`Version: snapshot ${snapshotId}`] : []),
  ];
}
