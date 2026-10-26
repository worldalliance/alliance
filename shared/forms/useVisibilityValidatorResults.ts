import { forEachCondition } from "@alliance/common/forms/form-conditions";
import { type FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import { useEffect, useMemo, useState } from "react";
import { customValidatorRunValidator } from "../client";
import { parseVisibilityValidatorResults } from "../parsed-dtos";

export function referencedValidatorIds(schema: FormSchema): number[] {
  const ids = new Set<number>();
  forEachCondition(schema, (condition) => {
    if (condition.kind === "validator") {
      ids.add(condition.validatorId);
    }
  });
  return Array.from(ids);
}

/**
 * Runs every validator a `visibleIfFormula` references and caches the verdicts
 * by validator id. A completed response replays its saved verdicts instead, so
 * a read-only form shows the pages the submitter actually saw.
 */
export function useVisibilityValidatorResults(args: {
  schema: FormSchema;
  readOnly: boolean;
  /** The response's raw jsonb blob, validated here rather than by the caller. */
  savedResults?: Record<string, unknown> | null;
  /** Whether anyone, a member or a previewing admin, can run a validator. A guest fails them all. */
  signedIn: boolean;
}): {
  results: Record<number, boolean>;
  /** A run failed, so its verdict reads as hidden without being known. */
  failed: boolean;
} {
  const { schema, readOnly, savedResults, signedIn } = args;

  const visibilityValidatorIds = useMemo(
    () => referencedValidatorIds(schema),
    [schema],
  );

  const [results, setResults] = useState<Record<number, boolean>>({});
  const [failedIds, setFailedIds] = useState<ReadonlySet<number>>(new Set());

  // A response saved before a validator was added has no verdict for it, and a
  // missing verdict reads as hidden, so default to passing.
  const readOnlyResults = useMemo(() => {
    const defaults: Record<number, boolean> = {};
    for (const id of visibilityValidatorIds) {
      defaults[id] = true;
    }
    return {
      ...defaults,
      ...R.unwrapOr(parseVisibilityValidatorResults(savedResults), {}),
    };
  }, [visibilityValidatorIds, savedResults]);

  // Drop verdicts for validators the schema no longer references. Returning
  // `prev` when there are none matters: a fresh object here re-runs the fetch
  // below, which would request every validator a second time on mount.
  useEffect(() => {
    if (readOnly) {
      return;
    }
    setResults((prev) => {
      const referenced = new Set(visibilityValidatorIds);
      const kept = Object.entries(prev).filter(([id]) =>
        referenced.has(Number(id)),
      );
      if (kept.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(kept);
    });
  }, [visibilityValidatorIds, readOnly]);

  const guestResults = useMemo(
    () => Object.fromEntries(visibilityValidatorIds.map((id) => [id, false])),
    [visibilityValidatorIds],
  );

  useEffect(() => {
    if (readOnly || !signedIn) {
      return;
    }
    const missingIds = visibilityValidatorIds.filter((id) => !(id in results));
    if (!missingIds.length) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        missingIds.map(async (validatorId) => {
          try {
            const response = await customValidatorRunValidator({
              path: { id: validatorId },
              body: {},
            });
            if (!response.data || response.error) {
              throw response.error ?? new Error("Missing validator response");
            }
            return { validatorId, isValid: response.data.isValid, ok: true };
          } catch (error) {
            console.error(
              `Failed to evaluate visibility validator ${validatorId}`,
              error,
            );
            return { validatorId, isValid: false, ok: false };
          }
        }),
      );
      if (cancelled) return;
      setResults((prev) => {
        const next = { ...prev };
        for (const { validatorId, isValid } of entries) {
          next[validatorId] = isValid;
        }
        return next;
      });
      setFailedIds((prev) => {
        const next = new Set(prev);
        for (const { validatorId, ok } of entries) {
          if (ok) next.delete(validatorId);
          else next.add(validatorId);
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [visibilityValidatorIds, results, readOnly, signedIn]);

  const failed =
    !readOnly &&
    signedIn &&
    visibilityValidatorIds.some((id) => failedIds.has(id));
  return useMemo(
    () => ({
      results: readOnly ? readOnlyResults : signedIn ? results : guestResults,
      failed,
    }),
    [readOnly, readOnlyResults, signedIn, results, guestResults, failed],
  );
}
