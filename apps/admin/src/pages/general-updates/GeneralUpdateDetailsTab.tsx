import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { formatCount } from "../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import type { useActionSuitesAdmin } from "../../lib/useActionSuitesAdmin";
import type { useTagsAdmin } from "../../lib/useTagsAdmin";
import { placeById, PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import DateTimePicker, { timeZoneLabel } from "../../ui/DateTimePicker";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Skeleton } from "../../ui/Skeleton";
import { linkClass } from "../../ui/styles";
import {
  CheckboxField,
  Field,
  FieldGroup,
  FormSection,
  SaveBar,
} from "../../ui/templates/Form";
import { PageBody } from "../../ui/templates/Page";
import UserSelect, { type useSelectableUsers } from "../../ui/UserSelect";
import {
  saveReachOf,
  usesSuiteSchedule,
  withSuite,
  type GeneralUpdateFieldsProps,
} from "./generalUpdateRules";
import type { GeneralUpdateDetails } from "./useGeneralUpdateDetails";

type Suites = ReturnType<typeof useActionSuitesAdmin>["suites"];

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

export function GeneralUpdateDetailsTab({
  details,
  isNew,
  suites,
  tags,
  users,
}: {
  details: GeneralUpdateDetails;
  isNew: boolean;
  suites: Suites;
  tags: ReturnType<typeof useTagsAdmin>;
  users: ReturnType<typeof useSelectableUsers>;
}) {
  const { form, setForm, errors } = details;
  return (
    <PageBody width="form">
      <form
        ref={details.formRef}
        onSubmit={(event) => void details.submit(event)}
        noValidate
      >
        <FormSection
          title="Details"
          description="Members see the title. The rest sets when it shows, and on whose home page."
          footer={
            <SaveBar
              state={details.state}
              error={details.saveError}
              note={saveReachOf(form, new Date())}
              saveLabel={isNew ? "Create general update" : "Save changes"}
              onDiscard={details.discard}
            />
          }
        >
          <Field
            label="Title"
            help="Shown to members as the update's heading."
            error={errors.name}
          >
            {(control) => (
              <Input
                {...control}
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            )}
          </Field>
          <SuiteFields form={form} setForm={setForm} suites={suites} />
          <ScheduleFields form={form} setForm={setForm} />
          <TagFields form={form} setForm={setForm} tags={tags} />
          <CohortFields form={form} setForm={setForm} users={users} />
        </FormSection>
      </form>
    </PageBody>
  );
}

function SuiteFields({
  form,
  setForm,
  suites,
}: GeneralUpdateFieldsProps & { suites: Suites }) {
  const available = suites.data ?? [];
  const unassigned = available.filter(
    (suite) => !form.suiteIds.includes(suite.id),
  );
  const listRef = useRef<HTMLUListElement>(null);
  const addRef = useRef<HTMLSelectElement>(null);
  // After Remove takes its row away, focus goes to the next suite's Remove,
  // else the one before, else the select.
  const [focusAfter, setFocusAfter] = useState<number | "add" | null>(null);
  useEffect(() => {
    if (focusAfter === null) return;
    const target =
      focusAfter === "add"
        ? addRef.current
        : listRef.current?.querySelector<HTMLElement>(
            `[data-suite="${focusAfter}"] button`,
          );
    target?.focus();
    setFocusAfter(null);
  }, [focusAfter]);

  const remove = (suiteId: number) => {
    const index = form.suiteIds.indexOf(suiteId);
    setFocusAfter(
      form.suiteIds[index + 1] ?? form.suiteIds[index - 1] ?? "add",
    );
    setForm((prev) => ({
      ...prev,
      suiteIds: prev.suiteIds.filter((id) => id !== suiteId),
    }));
  };

  return (
    <FieldGroup
      label="Suites"
      mark="optional"
      help={
        suites.isPending
          ? "Loading suites…"
          : available.length === 0 && !suites.isLoadingError
            ? "No suites yet."
            : "With a suite, the update starts and ends with Members taking action on one of the suite's tasks. Until that task has those events, the update keeps the dates it has."
      }
      error={
        suites.isLoadingError
          ? "Couldn't load suites, so none can be added."
          : null
      }
    >
      {form.suiteIds.length > 0 && (
        <ul ref={listRef} className="flex flex-col gap-1.5">
          {form.suiteIds.map((suiteId) => {
            const name =
              available.find((suite) => suite.id === suiteId)?.name ??
              `Suite #${suiteId}`;
            return (
              <li
                key={suiteId}
                data-suite={suiteId}
                className="flex h-control items-center justify-between gap-2 rounded-md border border-line bg-surface-2 pr-1 pl-2.5"
              >
                <span className="truncate font-medium">{name}</span>
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  aria-label={`Remove: ${name}`}
                  onClick={() => remove(suiteId)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Select
        ref={addRef}
        aria-label="Add suite"
        value=""
        disabled={unassigned.length === 0}
        onChange={(event) => {
          const suiteId = Number(event.target.value);
          if (event.target.value) setForm((prev) => withSuite(prev, suiteId));
        }}
      >
        <option value="">Add a suite…</option>
        {unassigned.map((suite) => (
          <option key={suite.id} value={suite.id}>
            {suite.name}
          </option>
        ))}
      </Select>
    </FieldGroup>
  );
}

const DATES = [
  { key: "startDate", label: "Start date" },
  { key: "endDate", label: "End date" },
] as const;

function ScheduleFields({ form, setForm }: GeneralUpdateFieldsProps) {
  const inherited = usesSuiteSchedule(form);
  return (
    // Always rendered, with one line of help either way, so adding the first
    // suite moves nothing below.
    <FieldGroup
      label="Schedule"
      help={
        inherited
          ? "Not used while the update has a suite: its dates come from the suite."
          : "From its start, members see the update. Its end takes it off their home pages only."
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {DATES.map(({ key, label }) => (
          <Field key={key} label={`${label} (${ZONE})`} mark="optional">
            {(control) => (
              <DateTimePicker
                {...control}
                timeZone={LAUNCH_TIME_ZONE}
                disabled={inherited}
                value={form[key] || null}
                onChange={(change) =>
                  setForm((prev) => ({ ...prev, [key]: change.utcValue ?? "" }))
                }
              />
            )}
          </Field>
        ))}
      </div>
    </FieldGroup>
  );
}

function TagFields({
  form,
  setForm,
  tags: { tags, isLoading, isLoadingError },
}: GeneralUpdateFieldsProps & { tags: ReturnType<typeof useTagsAdmin> }) {
  return (
    <FieldGroup
      label="Tags"
      help="Members with any ticked tag, and a contract active through the update's dates, get it on their home page. With none ticked, nobody does, unless the manual cohort is on."
      error={
        isLoadingError ? "Couldn't load tags, so none can be ticked." : null
      }
    >
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : isLoadingError ? null : tags.length === 0 ? (
        <p className="text-fg-muted">
          No tags yet. Create one in{" "}
          <Link to={placeById(PlaceId.Tags).path} className={linkClass}>
            Tags
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
          {tags.map((tag) => (
            <CheckboxField
              key={tag.id}
              label={tag.name}
              help={
                tag.publicDisplayName
                  ? `Public name: ${tag.publicDisplayName}`
                  : undefined
              }
              checked={form.tagIds.includes(tag.id)}
              onChange={() =>
                setForm((prev) => ({
                  ...prev,
                  tagIds: prev.tagIds.includes(tag.id)
                    ? prev.tagIds.filter((id) => id !== tag.id)
                    : [...prev.tagIds, tag.id],
                }))
              }
            />
          ))}
        </div>
      )}
    </FieldGroup>
  );
}

function CohortFields({
  form,
  setForm,
  users,
}: GeneralUpdateFieldsProps & {
  users: ReturnType<typeof useSelectableUsers>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CheckboxField
        label={
          form.useManualCohort
            ? `Manual cohort (${formatCount(form.manualCohortUserIds.length)})`
            : "Manual cohort"
        }
        help="Only the members picked here get the update on their home page, and the tags are ignored. Unticking clears the picks."
        checked={form.useManualCohort}
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            useManualCohort: event.target.checked,
            manualCohortUserIds: event.target.checked
              ? prev.manualCohortUserIds
              : [],
          }))
        }
      />
      {/* Always rendered, so ticking the box moves nothing. */}
      <div className="pl-6.5">
        <UserSelect
          users={users.users}
          selectedUserIds={form.manualCohortUserIds}
          onChange={(ids) =>
            setForm((prev) => ({ ...prev, manualCohortUserIds: ids }))
          }
          loading={users.isLoading}
          loadFailed={users.isLoadingError}
          label="Members in the manual cohort"
          disabled={!form.useManualCohort}
          hint={
            form.useManualCohort
              ? "Nobody picked, so the update is on no home page."
              : "Tick Manual cohort to pick members."
          }
        />
      </div>
    </div>
  );
}
