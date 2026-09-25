import { SourceHistoriesStatus } from "@alliance/shared/forms/useVariableSourceHistories";
import type { VariableInputsGate } from "@alliance/shared/forms/variableInputsGate";
import {
  sourceAnswersLoadFailed,
  variableSourceDeleted,
} from "@alliance/shared/lib/copy";
import { RotateCw } from "lucide-react";
import type { ReactElement } from "react";
import Spinner from "../ui/Spinner";

/**
 * What a form renders in place of itself until what its variables load is
 * ready. A read-only form reading a deleted form or question still shows,
 * with the variables reading it unresolved.
 */
export function variableInputsGateView(params: {
  gate: VariableInputsGate;
  readOnly: boolean;
}): ReactElement | null {
  const { gate, readOnly } = params;
  switch (gate.status) {
    case SourceHistoriesStatus.Loading:
      return (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      );
    case SourceHistoriesStatus.Failed:
      return (
        <div
          className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
          role="alert"
        >
          <p className="text-sm">{sourceAnswersLoadFailed}</p>
          <button
            type="button"
            onClick={gate.retry}
            aria-label="Try again"
            title="Try again"
            className="shrink-0 rounded p-1 hover:bg-amber-100"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      );
    case SourceHistoriesStatus.SourceDeleted:
      if (readOnly) return null;
      return (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          {variableSourceDeleted}
        </div>
      );
    case SourceHistoriesStatus.Ready:
      return null;
    default:
      throw new Error(
        `unknown variable inputs status: ${gate satisfies never}`,
      );
  }
}
