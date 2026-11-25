import { useEffect, useRef, useState } from "react";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import AppMarkdownWrapper from "../../ui/AppMarkdownWrapper";
import Button, { ButtonVariant } from "../../ui/Button";
import DateTimePicker, { timeZoneLabel } from "../../ui/DateTimePicker";
import { Input } from "../../ui/Input";
import { Textarea } from "../../ui/Textarea";
import { Field, FieldGroup } from "../../ui/templates/Form";
import {
  newPoint,
  type ContractErrors,
  type ContractFieldsProps,
  type PointRow,
} from "./contractForm";

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

/** The fields of a contract, for both `/new` and an existing one. */
export function ContractFields({
  form,
  setForm,
  errors,
  contractId,
}: ContractFieldsProps & {
  errors: ContractErrors;
  /** Null for a new contract, whose text is still editable. */
  contractId: number | null;
}) {
  return (
    <>
      <Field
        label="Name"
        mark="optional"
        help="Only staff see the name. Without one, the contract goes by its number."
      >
        {(control) => (
          <Input
            {...control}
            value={form.name}
            placeholder={
              contractId === null ? undefined : `Contract #${contractId}`
            }
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
        )}
      </Field>
      {contractId === null ? (
        <TextField form={form} setForm={setForm} error={errors.markdown} />
      ) : (
        <FieldGroup
          label="Text"
          help="Members sign this text, so it can't be changed once the contract exists. To change it, create a new contract with the new text; once its start date passes, members are asked to sign it, and members on this one see “An updated agreement is available” on their Membership page."
        >
          <MemberPreview markdown={form.markdown} />
        </FieldGroup>
      )}
      <PointFields
        form={form}
        setForm={setForm}
        errors={errors.points}
        error={errors.noPoints}
      />
      <FieldGroup
        label="Schedule"
        error={errors.schedule}
        help="When they join or on their Membership page, members are asked to sign the contract that started last, of those whose start has passed and whose end hasn't."
      >
        <div className="grid grid-cols-2 gap-4">
          <DateField
            label={`Start date (${ZONE})`}
            clearLabel="Clear start date"
            value={form.startDate}
            onChange={(startDate) =>
              setForm((prev) => ({ ...prev, startDate }))
            }
          />
          <DateField
            label={`End date (${ZONE})`}
            clearLabel="Clear end date"
            error={errors.endDate}
            value={form.endDate}
            onChange={(endDate) => setForm((prev) => ({ ...prev, endDate }))}
          />
        </div>
      </FieldGroup>
    </>
  );
}

/** The picker has no clear control of its own, so each date gets one. */
function DateField({
  label,
  clearLabel,
  error,
  value,
  onChange,
}: {
  label: string;
  clearLabel: string;
  error?: string;
  /** A UTC instant as an ISO string, or "" for none. */
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} mark="optional" error={error}>
      {(control) => (
        <div className="flex items-center gap-2">
          <DateTimePicker
            {...control}
            wrapperClassName="min-w-0 flex-1"
            timeZone={LAUNCH_TIME_ZONE}
            value={value || null}
            onChange={(change) => onChange(change.utcValue ?? "")}
          />
          {value && (
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              aria-label={clearLabel}
              onClick={() => {
                onChange("");
                // The button unmounts with the value, so focus moves to the field.
                document.getElementById(control.id)?.focus();
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </Field>
  );
}

function MemberPreview({ markdown }: { markdown: string }) {
  return (
    <div className="member-surface max-h-96 overflow-y-auto rounded-md border border-line bg-surface-2 px-4 py-3">
      {markdown.trim() ? (
        <AppMarkdownWrapper markdownContent={markdown} />
      ) : (
        <p className="text-fg-muted">Nothing to preview yet.</p>
      )}
    </div>
  );
}

function TextField({
  form,
  setForm,
  error,
}: ContractFieldsProps & { error?: string }) {
  return (
    <>
      <Field
        label="Text"
        help="Markdown. Members sign this text, and it can't be changed once the contract is created."
        error={error}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={10}
            className="font-mono text-xs"
            value={form.markdown}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, markdown: event.target.value }))
            }
          />
        )}
      </Field>
      <FieldGroup label="Preview">
        <MemberPreview markdown={form.markdown} />
      </FieldGroup>
    </>
  );
}

function PointFields({
  form,
  setForm,
  errors,
  error,
}: ContractFieldsProps & {
  errors?: Record<string, string>;
  error?: string;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // After Remove takes its point away, focus goes to the next point's Remove,
  // else the one before, else Add point.
  const [focusAfter, setFocusAfter] = useState<string | "add" | null>(null);
  useEffect(() => {
    if (focusAfter === null) return;
    const target =
      focusAfter === "add"
        ? addRef.current
        : listRef.current?.querySelector<HTMLElement>(
            `[data-point="${focusAfter}"] [data-remove]`,
          );
    target?.focus();
    setFocusAfter(null);
  }, [focusAfter]);

  const change = (key: string, patch: Partial<PointRow>) =>
    setForm((prev) => ({
      ...prev,
      points: prev.points.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    }));
  const remove = (key: string) => {
    const index = form.points.findIndex((row) => row.key === key);
    setFocusAfter(
      form.points[index + 1]?.key ?? form.points[index - 1]?.key ?? "add",
    );
    setForm((prev) => ({
      ...prev,
      points: prev.points.filter((row) => row.key !== key),
    }));
  };

  return (
    <FieldGroup
      label="Points"
      error={error}
      help="Members see the points above the text."
    >
      {form.points.length > 0 && (
        <ol ref={listRef} className="flex flex-col gap-3">
          {form.points.map((row, index) => (
            <li
              key={row.key}
              data-point={row.key}
              className="flex flex-col gap-3 rounded-md bg-surface-2 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Point {index + 1}</span>
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  data-remove
                  aria-label={`Remove point ${index + 1}`}
                  onClick={() => remove(row.key)}
                >
                  Remove
                </Button>
              </div>
              <Field label="Point" error={errors?.[row.key]}>
                {(control) => (
                  <Textarea
                    {...control}
                    rows={2}
                    className="min-h-0 font-mono text-xs"
                    value={row.point}
                    onChange={(event) =>
                      change(row.key, { point: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="Subtext" mark="optional">
                {(control) => (
                  <Textarea
                    {...control}
                    rows={2}
                    className="min-h-0 font-mono text-xs"
                    value={row.subtext}
                    onChange={(event) =>
                      change(row.key, { subtext: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field
                label="Admin notes"
                mark="optional"
                help="Only staff see these, here in the admin."
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={2}
                    className="min-h-0"
                    value={row.adminNotes}
                    onChange={(event) =>
                      change(row.key, { adminNotes: event.target.value })
                    }
                  />
                )}
              </Field>
              <div className="member-surface rounded-md border border-line bg-surface px-3 py-2">
                {row.point.trim() || row.subtext.trim() ? (
                  <>
                    <div className="font-semibold">
                      <AppMarkdownWrapper markdownContent={row.point} />
                    </div>
                    <AppMarkdownWrapper markdownContent={row.subtext} />
                  </>
                ) : (
                  <p className="text-fg-muted">Nothing to preview yet.</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button
          ref={addRef}
          size="small"
          variant={ButtonVariant.Default}
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              points: [...prev.points, newPoint()],
            }))
          }
        >
          Add point
        </Button>
      </div>
    </FieldGroup>
  );
}
