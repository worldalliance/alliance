import type { TagDto } from "@alliance/shared/client/types.gen";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { countOf } from "../../lib/formatNumber";
import { memberHref } from "../../lib/hrefs";
import Button, { ButtonVariant } from "../../ui/Button";
import Card from "../../ui/Card";
import InlineError from "../../ui/InlineError";
import { personName } from "../../ui/PersonCell";
import { linkClass } from "../../ui/styles";
import { ExpandToggle } from "../../ui/Table";
import { useFocusFirstInvalid } from "../../ui/templates/Form";
import { TagFields } from "./TagFields";
import type { TagFormErrors, TagFormValues } from "./tagRules";

export enum TagWrite {
  Saving = "saving",
  Deleting = "deleting",
}

export type TagEdit = {
  values: TagFormValues;
  errors: TagFormErrors;
  refusal: string | null;
};

export function TagCard({
  tag,
  focusRow,
  edit,
  write,
  onEdit,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: {
  tag: TagDto;
  focusRow: { "data-focus-row": string };
  edit: TagEdit | undefined;
  write: TagWrite | undefined;
  onEdit: () => void;
  onChange: (values: TagFormValues) => void;
  onCancel: () => void;
  /** Returns whether the fields were valid, so a bad one can take focus. */
  onSave: () => boolean;
  onDelete: () => void;
}) {
  const membersId = useId();
  const [membersOpen, setMembersOpen] = useState(false);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const editing = edit !== undefined;
  useEffect(() => {
    if (editing) formRef.current?.querySelector("input")?.focus();
  }, [editing, formRef]);
  const members = [...tag.users].sort((a, b) =>
    personName({ userId: a.id, name: a.displayName }).localeCompare(
      personName({ userId: b.id, name: b.displayName }),
    ),
  );

  return (
    <li data-tag={tag.id} {...focusRow}>
      <Card className="gap-3">
        <div className="flex min-h-control-sm items-start justify-between gap-3">
          <h2 className="min-w-0 text-heading font-semibold wrap-anywhere">
            {tag.name}
          </h2>
          {!edit && (
            <div className="flex shrink-0 gap-2">
              <Button
                size="small"
                variant={ButtonVariant.Default}
                aria-label={`Edit: ${tag.name}`}
                onClick={onEdit}
                disabled={write === TagWrite.Deleting}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant={ButtonVariant.DangerOutline}
                aria-label={`Delete: ${tag.name}`}
                onClick={onDelete}
                busy={write === TagWrite.Deleting}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
        {edit ? (
          <form
            ref={formRef}
            noValidate
            className="flex max-w-176 flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!onSave()) focusFirstInvalid();
            }}
          >
            <TagFields
              values={edit.values}
              errors={edit.errors}
              onChange={onChange}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={ButtonVariant.Primary}
                type="submit"
                busy={write === TagWrite.Saving}
              >
                Save changes
              </Button>
              <Button
                variant={ButtonVariant.Ghost}
                onClick={onCancel}
                disabled={write === TagWrite.Saving}
              >
                Cancel
              </Button>
              <InlineError message={edit.refusal} />
            </div>
          </form>
        ) : (
          <>
            {tag.publicDisplayName && (
              <p className="text-fg-muted wrap-anywhere">
                Public name: {tag.publicDisplayName}
              </p>
            )}
            {tag.description && (
              <p className="max-w-prose whitespace-pre-wrap wrap-anywhere">
                {tag.description}
              </p>
            )}
          </>
        )}
        {members.length === 0 ? (
          <p className="flex h-control-sm items-center text-fg-muted">
            No members
          </p>
        ) : (
          <div>
            <ExpandToggle
              expanded={membersOpen}
              controls={membersId}
              onToggle={() => setMembersOpen((open) => !open)}
              aria-label={`${countOf(members.length, "member")}: ${tag.name}`}
            >
              {countOf(members.length, "member")}
            </ExpandToggle>
            {membersOpen && (
              <ul
                id={membersId}
                className="flex flex-wrap gap-x-4 gap-y-1 pt-2"
              >
                {members.map((member) => (
                  <li key={member.id}>
                    <Link to={memberHref(member.id)} className={linkClass}>
                      {personName({
                        userId: member.id,
                        name: member.displayName,
                      })}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}
