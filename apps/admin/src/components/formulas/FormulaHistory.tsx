import type { FormulaDto } from "@alliance/shared/client";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import React, { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useFormulaVersionsAdmin } from "../../lib/useFormulasAdmin";

/** Every saved version, newest first, loaded once opened. */
const FormulaHistory: React.FC<{
  formula: Pick<FormulaDto, "id" | "versionId">;
}> = ({ formula }) => {
  const [open, setOpen] = useState(false);
  const versions = useFormulaVersionsAdmin({ formula, enabled: open });
  return (
    <details
      className="max-w-3xl"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold text-zinc-900">
        History
      </summary>
      {versions.isPending ? (
        <p className="text-sm text-zinc-600 mt-2" role="status">
          Loading history…
        </p>
      ) : versions.isError ? (
        <p className="text-sm text-red-700 mt-2" role="alert">
          {adminRefusalMessage(versions.error, "Couldn't load the history.")}
        </p>
      ) : (
        <ol className="mt-2 space-y-4">
          {versions.data.map((version) => (
            <li key={version.id} className="space-y-1">
              <p className="text-sm text-zinc-600">
                {formatDateTime(new Date(version.createdAt))}
                {version.savedByName !== null && ` by ${version.savedByName}`}
                {" as "}
                <span className="font-mono">{version.name}</span>
              </p>
              <pre className="text-xs font-mono bg-zinc-50 border border-zinc-200 rounded p-2 whitespace-pre-wrap">
                {version.text}
              </pre>
              {version.notes !== null && (
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">
                  {version.notes}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
};

export default FormulaHistory;
