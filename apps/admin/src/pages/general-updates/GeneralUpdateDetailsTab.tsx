import { Link } from "react-router";
import { formatCount } from "../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import type { useActionSuitesAdmin } from "../../lib/useActionSuitesAdmin";
import type { useTagsAdmin } from "../../lib/useTagsAdmin";
import { placeById, PlaceId } from "../../places";
import { MultiCombobox } from "../../ui/Combobox";
import DateTimePicker, { timeZoneLabel } from "../../ui/DateTimePicker";
import { Input } from "../../ui/Input";
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
  const options = [
    ...available.map((suite) => ({ value: suite.id, label: suite.name })),
    ...form.suiteIds
      .filter((id) => !available.some((suite) => suite.id === id))
      .map((id) => ({ value: id, label: `Suite #${id}` })),
  ];
  return (
    <Field
      label="Suites"
      mark="optional"
      help="With a suite, the update starts and ends with Members taking action on one of the suite's tasks. Until that task has those events, the update keeps the dates it has."
      error={
        suites.isLoadingError
          ? "Couldn't load suites, so none can be added."
          : null
      }
    >
      {(control) => (
        <MultiCombobox
          {...control}
          options={options}
          values={form.suiteIds}
          onChange={(suiteIds) => setForm((prev) => ({ ...prev, suiteIds }))}
          placeholder="Add a suite"
          emptyText={available.length === 0 ? "No suites yet" : "No matches"}
          loading={suites.isPending}
          loadError={suites.isLoadingError ? "Couldn't load suites" : null}
        />
      )}
    </Field>
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
