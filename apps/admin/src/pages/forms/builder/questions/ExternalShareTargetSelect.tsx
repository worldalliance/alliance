import type { ExternalShareTargetDto } from "@alliance/shared/client";
import { Link } from "react-router";
import {
  externalShareTargetsLoadError,
  useExternalShareTargetsAdmin,
} from "../../../../lib/useExternalShareTargetsAdmin";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";

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
    <Field
      label={label}
      error={error}
      help={
        <>
          {isOrphaned && (
            <span className="block text-warning">
              Selected target #{value} no longer exists. Pick another.
            </span>
          )}
          {description}
          {description ? " " : ""}
          <Link
            to="/growth/links?tab=share-targets"
            className="text-accent hover:underline"
          >
            Manage targets →
          </Link>
        </>
      }
    >
      {(control) =>
        isPending ? (
          <p className="text-caption text-fg-muted">Loading targets…</p>
        ) : !targets ? (
          <p className="text-caption text-danger">
            {externalShareTargetsLoadError(loadError)}
          </p>
        ) : showSelect ? (
          <Select
            {...control}
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
          </Select>
        ) : (
          <p className="text-caption text-fg-muted">
            No external share targets configured yet.
          </p>
        )
      }
    </Field>
  );
}
