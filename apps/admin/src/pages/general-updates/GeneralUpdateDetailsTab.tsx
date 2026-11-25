import { Link } from "react-router";
import type { useActionSuitesAdmin } from "../../lib/useActionSuitesAdmin";
import type { useTagsAdmin } from "../../lib/useTagsAdmin";
import { placeById, PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import DateTimePicker from "../../ui/DateTimePicker";
import { Select } from "../../ui/Select";
import { Skeleton } from "../../ui/Skeleton";
import { linkClass } from "../../ui/styles";
import {
  CheckboxField,
  Field,
  FormSection,
  SaveBar,
} from "../../ui/templates/Form";
import { PageBody } from "../../ui/templates/Page";
import { Textarea } from "../../ui/Textarea";
import UserSelect, { type useSelectableUsers } from "../../ui/UserSelect";
import {
  saveReachOf,
  usesSuiteSchedule,
  withSuite,
  type GeneralUpdateFieldsProps,
} from "./generalUpdateRules";
import type { GeneralUpdateDetails } from "./useGeneralUpdateDetails";

type Suites = ReturnType<typeof useActionSuitesAdmin>["suites"];

const LOCAL_ZONE =
  new Intl.DateTimeFormat("en-US", { timeZoneName: "longGeneric" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value ?? "your local time";

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
          description="Members see the title. The rest decides when the update is shown, and to whom."
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
            help="Shown to members at the top of the general update."
            error={errors.name}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={1}
                className="field-sizing-content min-h-control resize-none"
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
  const error = suites.isLoadingError ? "Failed to load suites." : null;
  const help = suites.isPending
    ? "Loading suites…"
    : available.length === 0 && !error
      ? "No suites available."
      : "With a suite, the update takes its start and end dates from a task in the suite.";
  return (
    <Field label="Suites" mark="optional" help={help} error={error}>
      {(control) => (
        <>
          {form.suiteIds.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {form.suiteIds.map((suiteId) => {
                const name =
                  available.find((suite) => suite.id === suiteId)?.name ??
                  `Suite #${suiteId}`;
                return (
                  <li
                    key={suiteId}
                    className="flex h-control items-center justify-between gap-2 rounded-md border border-line bg-surface-2 pr-1 pl-2.5"
                  >
                    <span className="truncate font-medium">{name}</span>
                    <Button
                      size="small"
                      variant={ButtonVariant.Ghost}
                      aria-label={`Remove: ${name}`}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          suiteIds: prev.suiteIds.filter(
                            (id) => id !== suiteId,
                          ),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <Select
            {...control}
            aria-label="Add suite"
            value=""
            disabled={unassigned.length === 0}
            onChange={(event) => {
              const suiteId = Number(event.target.value);
              if (event.target.value)
                setForm((prev) => withSuite(prev, suiteId));
            }}
          >
            <option value="">Add a suite…</option>
            {unassigned.map((suite) => (
              <option key={suite.id} value={suite.id}>
                {suite.name}
              </option>
            ))}
          </Select>
        </>
      )}
    </Field>
  );
}

function ScheduleFields({ form, setForm }: GeneralUpdateFieldsProps) {
  const inherited = usesSuiteSchedule(form);
  const dates = [
    { key: "startDate", label: "Start date" },
    { key: "endDate", label: "End date" },
  ] as const;
  return (
    // Always rendered, so adding the first suite moves nothing below.
    <div className="grid grid-cols-2 gap-4">
      {dates.map(({ key, label }) => (
        <Field
          key={key}
          label={`${label} (${LOCAL_ZONE})`}
          mark="optional"
          help={
            inherited
              ? "Not used: the dates come from the suite."
              : key === "startDate"
                ? "Members see the update from this time."
                : "Without one, the update stays until you set one."
          }
        >
          {(control) => (
            <DateTimePicker
              {...control}
              disabled={inherited}
              value={form[key]}
              onChange={(change) =>
                setForm((prev) => ({ ...prev, [key]: change.localValue }))
              }
            />
          )}
        </Field>
      ))}
    </div>
  );
}

function TagFields({
  form,
  setForm,
  tags: { tags, isLoading },
}: GeneralUpdateFieldsProps & { tags: ReturnType<typeof useTagsAdmin> }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="font-medium">Tags</legend>
      <p className="text-caption text-fg-muted">
        An update with no tags is shown to nobody, unless the manual cohort is
        on.
      </p>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : tags.length === 0 ? (
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
              help={tag.publicDisplayName || undefined}
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
    </fieldset>
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
            ? `Manual cohort (${form.manualCohortUserIds.length})`
            : "Manual cohort"
        }
        help="Pick specific members for this update. Unticking clears the picks."
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
      {/* Always rendered, so ticking the box moves nothing; a disabled fieldset disables the picker in it. */}
      <fieldset disabled={!form.useManualCohort} className="pl-6.5">
        <UserSelect
          users={users.users}
          selectedUserIds={form.manualCohortUserIds}
          onChange={(ids) =>
            setForm((prev) => ({ ...prev, manualCohortUserIds: ids }))
          }
          loading={users.isLoading}
          loadFailed={users.isLoadingError}
          label="Members in the manual cohort"
        />
      </fieldset>
    </div>
  );
}
