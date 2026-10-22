import type { FormSchema } from "@alliance/common/forms/form-schema";
import { sourceVariablesInSharedOutput } from "@alliance/common/forms/variable-interpolation";
import { useMemo } from "react";

export function SharedOutputSourceWarning({ schema }: { schema: FormSchema }) {
  const references = useMemo(
    () => sourceVariablesInSharedOutput(schema),
    [schema],
  );
  if (references.length === 0) return null;
  return (
    <div className="mb-6 rounded border border-red-300 bg-red-50 p-3 space-y-1">
      <p className="text-sm font-medium text-red-900">
        Output views can&apos;t show a variable that reads another form&apos;s
        answers or aggregate counts. Remove these references to save:
      </p>
      {references.map(({ name, location, viewId }) => (
        <p
          key={`${viewId}:${location}:${name}`}
          className="text-xs text-red-800"
        >
          <span className="font-mono">
            #{"{"}
            {name}
            {"}"}
          </span>{" "}
          in {viewId} › {location}
        </p>
      ))}
    </div>
  );
}
