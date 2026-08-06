import { R } from "@alliance/common/result";

export type ReturnToState = { returnTo: string };

export type SnapshotMigrationTarget = {
  formId: number;
  name: string;
};

// Any absolute origin works; avoiding `window` keeps this usable outside browsers.
const SAME_ORIGIN_BASE = "https://return-to.invalid";

export function getReturnTo(state: unknown, fallback: string): string {
  if (
    typeof state !== "object" ||
    state === null ||
    !("returnTo" in state) ||
    typeof state.returnTo !== "string" ||
    !state.returnTo.startsWith("/")
  ) {
    return fallback;
  }

  // Resolve rather than prefix-match: URL parsing folds backslashes into
  // slashes, so `/\evil.com` reaches another origin while passing any check on
  // a leading `//`.
  const candidate = state.returnTo;
  const parsed = R.fromThrowable(() => new URL(candidate, SAME_ORIGIN_BASE));
  if (!parsed.ok || parsed.value.origin !== SAME_ORIGIN_BASE) return fallback;

  const { pathname, search, hash } = parsed.value;
  return `${pathname}${search}${hash}`;
}

export function getDirectSnapshotTarget(params: {
  targets?: SnapshotMigrationTarget[];
  selectedFormId?: number | null;
}): SnapshotMigrationTarget | null {
  const { targets, selectedFormId } = params;
  if (!targets || targets.length === 0) return null;
  if (targets.length === 1) return targets[0];
  if (selectedFormId == null) return null;
  return targets.find((target) => target.formId === selectedFormId) ?? null;
}
