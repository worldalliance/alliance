import type { ExternalShareTargetDto } from "@alliance/shared/client";
import { Link } from "react-router";
import {
  externalShareTargetsLoadError,
  useExternalShareTargetsAdmin,
} from "../lib/useExternalShareTargetsAdmin";

interface ExternalShareTargetSelectProps {
  label: string;
  description?: string;
  value: number | null;
  onChange: (target: ExternalShareTargetDto) => void;
  onClear: () => void;
  error?: string;
}

export function ExternalShareTargetSelect({
  label,
  description,
  value,
  onChange,
  onClear,
  error,
}: ExternalShareTargetSelectProps) {
  const {
    data: targets,
    isPending,
    error: loadError,
  } = useExternalShareTargetsAdmin();

  const hasTargets = !!targets && targets.length > 0;
  const isOrphaned =
    !isPending &&
    value !== null &&
    !!targets &&
    !targets.some((t) => t.id === value);
  const showSelect = hasTargets || isOrphaned;

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      {isPending ? (
        <p className="text-xs text-gray-500">Loading targets…</p>
      ) : !targets ? (
        <p className="text-xs text-red-600">
          {externalShareTargetsLoadError(loadError)}
        </p>
      ) : showSelect ? (
        <select
          value={value ?? ""}
          onChange={(event) => {
            const next = targets.find(
              (t) => t.id === Number(event.target.value),
            );
            if (next) {
              onChange(next);
            } else {
              onClear();
            }
          }}
          className="bg-white w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a target…</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
          {isOrphaned && (
            <option value={value!}>Missing target #{value}</option>
          )}
        </select>
      ) : (
        <p className="text-xs text-gray-500">
          No external share targets configured yet.
        </p>
      )}
      <p className="text-xs text-gray-500">
        {description}
        {description ? " " : ""}
        <Link to="/share-targets" className="text-blue-600 hover:underline">
          Manage targets →
        </Link>
      </p>
      {isOrphaned && (
        <p className="text-xs text-amber-600">
          Selected target #{value} no longer exists. Pick another.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
