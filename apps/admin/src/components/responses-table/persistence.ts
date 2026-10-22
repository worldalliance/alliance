import { R } from "@alliance/common/result";
import { z } from "zod";
import { SnapshotMode } from "./columns";

const storedViewSchema = z.object({
  hiddenColumns: z.array(z.string()),
  expandRows: z.boolean(),
  snapshotMode: z.enum(SnapshotMode).nullable(),
});

export type StoredView = z.infer<typeof storedViewSchema>;

const storageKey = (formId: number | null): string =>
  `alliance.responsesTable.v1.${formId ?? "unknown"}`;

export function readStoredView(formId: number | null): StoredView | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(formId));
  if (!raw) return null;
  const parsed = R.fromThrowable(() => JSON.parse(raw));
  if (!parsed.ok) return null;
  const view = storedViewSchema.safeParse(parsed.value);
  return view.success ? view.data : null;
}

export function writeStoredView(params: {
  formId: number | null;
  view: StoredView;
}): void {
  if (typeof window === "undefined") return;
  R.fromThrowable(() =>
    window.localStorage.setItem(
      storageKey(params.formId),
      JSON.stringify(params.view),
    ),
  );
}
