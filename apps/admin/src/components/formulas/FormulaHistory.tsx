import type { FormulaDto } from "@alliance/shared/client";
import { ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { useFormulaVersionsAdmin } from "../../lib/useFormulasAdmin";

/** Every saved version, newest first, loaded once opened. */
const FormulaHistory: React.FC<{
  formula: Pick<FormulaDto, "id" | "versionId">;
}> = ({ formula }) => {
  const [open, setOpen] = useState(false);
  const versions = useFormulaVersionsAdmin({ formula, enabled: open });
  return (
    <details
      className="group overflow-hidden rounded-card border border-line bg-surface"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-card py-2 focus-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-muted transition-transform duration-fast group-open:rotate-90 motion-reduce:transition-none"
        />
        <h2 className="text-heading font-semibold">History</h2>
        <span className="text-caption text-fg-muted">Every saved version</span>
      </summary>
      <div className="border-t border-line p-card">
        {versions.isPending ? (
          <p className="text-fg-muted" role="status">
            Loading history…
          </p>
        ) : versions.isError ? (
          <p className="text-danger" role="alert">
            {adminRefusalMessage(versions.error, "Couldn't load the history.")}
          </p>
        ) : (
          <ol className="flex flex-col gap-5">
            {versions.data.map((version) => (
              <li key={version.id} className="flex flex-col gap-1.5">
                <p className="text-caption text-fg-muted">
                  {formatDateTime(version.createdAt)}
                  {version.savedByName !== null && ` by ${version.savedByName}`}
                  {" as "}
                  <span className="font-mono text-fg">{version.name}</span>
                </p>
                <pre className="rounded-md border border-line bg-surface-2 p-2 font-mono text-xs whitespace-pre-wrap">
                  {version.text}
                </pre>
                {version.notes !== null && (
                  <p className="whitespace-pre-wrap">{version.notes}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
};

export default FormulaHistory;
