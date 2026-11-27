import { R } from "@alliance/common/result";
import type {
  AdminWaitlistLinkDto,
  AdminWaitlistTagDto,
  CampaignDto,
  WaitlistCohortDto,
  WaitlistEntryFilterDto,
} from "@alliance/shared/client/types.gen";
import { useEffect, useState, type Ref } from "react";
import {
  fromDateInput,
  fromEndDateInput,
  toDateInput,
  toEndDateInput,
} from "../../lib/dateInput";
import { countOf } from "../../lib/formatNumber";
import {
  CONTACT_METHOD_LABELS,
  INITIAL_WAITLIST_FILTER,
  INVITE_STATE_LABELS,
  INVITE_STATES,
  isContactMethod,
  linkOptions,
  sameFilter,
  SPAM_STATUS_VALUES,
  SPAM_STATUSES,
  withFilterField,
} from "../../lib/waitlistFilter";
import Button, { ButtonVariant } from "../../ui/Button";
import { DateField } from "../../ui/DateField";
import { Select } from "../../ui/Select";
import { FilterChip, SearchField } from "../../ui/templates/List";
import { CohortControls } from "./CohortControls";
import { MultiSelectMenu } from "./MultiSelectMenu";

const SEARCH_DELAY_MS = 300;
const SEARCH_MAX_LENGTH = 200;

type BooleanField = "mobilized" | "subscribed" | "hasReason";

const BOOLEAN_FILTERS: Record<
  BooleanField,
  { label: string; yes: string; no: string }
> = {
  mobilized: { label: "Mobilized", yes: "Mobilized", no: "Waiting" },
  subscribed: { label: "Subscription", yes: "Subscribed", no: "Unsubscribed" },
  hasReason: { label: "Reason", yes: "Has reason", no: "No reason" },
};

const BOOLEAN_FIELDS: readonly BooleanField[] = [
  "mobilized",
  "subscribed",
  "hasReason",
];

/**
 * The entries' filters, in the filter bar. The search waits for typing to
 * stop before it filters; applying a cohort drops a search still being typed.
 */
export function EntryFilters({
  filter,
  onChange,
  cohorts,
  cohortId,
  onApplyCohort,
  organizations,
  links,
  tags,
  onFailure,
  searchRef,
}: {
  filter: WaitlistEntryFilterDto;
  onChange: (filter: WaitlistEntryFilterDto) => void;
  cohorts: WaitlistCohortDto[] | undefined;
  cohortId: number | null;
  onApplyCohort: (
    cohortId: number | null,
    filter?: WaitlistEntryFilterDto,
  ) => void;
  organizations: CampaignDto[] | undefined;
  links: AdminWaitlistLinkDto[] | undefined;
  tags: AdminWaitlistTagDto[] | undefined;
  onFailure: (message: string) => void;
  /** `useFocusAfterRemoval`'s fallback. */
  searchRef: Ref<{ focus: () => void }>;
}) {
  const [search, setSearch] = useState(filter.search ?? "");
  // Follows a search the URL changed (Back, a cohort), not one being typed.
  useEffect(() => {
    setSearch((typed) =>
      typed.trim() === (filter.search ?? "") ? typed : (filter.search ?? ""),
    );
  }, [filter.search]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim().slice(0, SEARCH_MAX_LENGTH);
      if (next !== (filter.search ?? "")) {
        onChange(withFilterField({ filter, key: "search", value: next }));
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, filter, onChange]);

  const set = <K extends keyof WaitlistEntryFilterDto>(
    key: K,
    value: WaitlistEntryFilterDto[K],
  ) => onChange(withFilterField({ filter, key, value }));

  const organizationName = new Map(
    (organizations ?? []).map((o) => [o.id, o.name]),
  );
  const referrers = filter.referrerIds?.length ?? 0;

  return (
    <>
      <SearchField
        ref={searchRef}
        label="Search name, email, or phone"
        className="w-64"
        value={search}
        onChange={setSearch}
      />
      <CohortControls
        cohorts={cohorts}
        cohortId={cohortId}
        filter={filter}
        onApply={(id, next) => {
          if (next) setSearch(next.search ?? "");
          onApplyCohort(id, next);
        }}
        onFailure={onFailure}
      />
      <MultiSelectMenu
        label="Organization"
        options={organizations?.map((o) => ({ value: o.id, label: o.name }))}
        selected={filter.organizationIds ?? []}
        onChange={(value) => set("organizationIds", value)}
      />
      <MultiSelectMenu
        label="Link"
        options={links && linkOptions(links, organizationName)}
        selected={filter.sourceLinkIds ?? []}
        onChange={(value) => set("sourceLinkIds", value)}
      />
      <MultiSelectMenu
        label="Invite"
        options={INVITE_STATES.map((state) => ({
          value: state,
          label: INVITE_STATE_LABELS[state],
        }))}
        selected={filter.inviteStates ?? []}
        onChange={(value) => set("inviteStates", value)}
      />
      <MultiSelectMenu
        label="Spam"
        options={SPAM_STATUS_VALUES.map((status) => ({
          value: status,
          label: SPAM_STATUSES[status].label,
        }))}
        selected={filter.spamStatuses ?? []}
        onChange={(value) => set("spamStatuses", value)}
      />
      <MultiSelectMenu
        label="Tag"
        options={tags?.map((tag) => ({ value: tag.id, label: tag.name }))}
        selected={filter.tagIds ?? []}
        onChange={(value) => set("tagIds", value)}
      />
      <Select
        aria-label="Contact"
        className="h-control-sm w-auto"
        value={filter.contactMethod ?? ""}
        onChange={(event) =>
          set(
            "contactMethod",
            isContactMethod(event.target.value)
              ? event.target.value
              : undefined,
          )
        }
      >
        <option value="">Contact: any</option>
        {Object.entries(CONTACT_METHOD_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      {BOOLEAN_FIELDS.map((key) => {
        const { label, yes, no } = BOOLEAN_FILTERS[key];
        const value = filter[key];
        return (
          <Select
            key={key}
            aria-label={label}
            className="h-control-sm w-auto"
            value={value === undefined ? "" : String(value)}
            onChange={(event) =>
              set(
                key,
                event.target.value === ""
                  ? undefined
                  : event.target.value === "true",
              )
            }
          >
            <option value="">{label}: any</option>
            <option value="true">{yes}</option>
            <option value="false">{no}</option>
          </Select>
        );
      })}
      <div
        role="group"
        aria-label="Joined"
        className="flex items-center gap-1.5"
      >
        <span className="text-fg-muted">Joined</span>
        <DateField
          aria-label="Joined on or after"
          className="h-control-sm w-36"
          value={toDateInput(filter.joinedFrom)}
          onChange={(value) => {
            const from = fromDateInput(value);
            if (R.isSuccess(from)) set("joinedFrom", from.value ?? undefined);
          }}
        />
        <span aria-hidden="true" className="text-fg-muted">
          –
        </span>
        <DateField
          aria-label="Joined on or before"
          className="h-control-sm w-36"
          value={toEndDateInput(filter.joinedBefore)}
          onChange={(value) => {
            const before = fromEndDateInput(value);
            if (R.isSuccess(before)) {
              set("joinedBefore", before.value ?? undefined);
            }
          }}
        />
      </div>
      {referrers > 0 && (
        <FilterChip
          field="Referred by"
          value={countOf(referrers, "entry")}
          onRemove={() => set("referrerIds", undefined)}
        />
      )}
      {!sameFilter(filter, INITIAL_WAITLIST_FILTER) && (
        <Button
          variant={ButtonVariant.Ghost}
          size="small"
          onClick={() => {
            setSearch("");
            onChange(INITIAL_WAITLIST_FILTER);
          }}
        >
          Clear filters
        </Button>
      )}
    </>
  );
}
