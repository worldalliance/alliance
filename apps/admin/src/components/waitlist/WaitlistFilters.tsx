import type {
  AdminWaitlistLinkDto,
  AdminWaitlistTagDto,
  CampaignDto,
  WaitlistEntryFilterDto,
} from "@alliance/shared/client/types.gen";
import { FilterX, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  fromDateInput,
  fromEndDateInput,
  toDateInput,
  toEndDateInput,
} from "../../lib/dateInput";
import {
  INITIAL_WAITLIST_FILTER,
  INVITE_STATE_LABELS,
  INVITE_STATES,
  linkOptions,
  sameFilter,
  SPAM_STATUS_VALUES,
  SPAM_STATUSES,
  withFilterField,
} from "../../lib/waitlistFilter";
import MultiSelectFilter from "./MultiSelectFilter";
import { ICON_BUTTON_CLASS, SELECT_CLASS } from "./controlClasses";

const BOOLEAN_FIELDS = ["mobilized", "subscribed", "hasReason"] as const;
type BooleanField = (typeof BOOLEAN_FIELDS)[number];

const BooleanFilter: React.FC<{
  label: string;
  yes: string;
  no: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
}> = ({ label, yes, no, value, onChange }) => (
  <select
    aria-label={label}
    className={SELECT_CLASS}
    value={value === undefined ? "" : String(value)}
    onChange={(e) =>
      onChange(e.target.value === "" ? undefined : e.target.value === "true")
    }
  >
    <option value="">{label}: any</option>
    <option value="true">{yes}</option>
    <option value="false">{no}</option>
  </select>
);

type WaitlistFiltersProps = {
  filter: WaitlistEntryFilterDto;
  onChange: (filter: WaitlistEntryFilterDto) => void;
  organizations: CampaignDto[] | undefined;
  links: AdminWaitlistLinkDto[] | undefined;
  tags: AdminWaitlistTagDto[] | undefined;
};

const WaitlistFilters: React.FC<WaitlistFiltersProps> = ({
  filter,
  onChange,
  organizations,
  links,
  tags,
}) => {
  const [search, setSearch] = useState(filter.search ?? "");
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== (filter.search ?? "")) {
        onChange(
          withFilterField({ filter, key: "search", value: search.trim() }),
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filter, onChange]);

  const set = <K extends keyof WaitlistEntryFilterDto>(
    key: K,
    value: WaitlistEntryFilterDto[K],
  ) => onChange(withFilterField({ filter, key, value }));

  const organizationName = new Map(
    (organizations ?? []).map((o) => [o.id, o.name]),
  );
  const booleanFilters: Record<
    BooleanField,
    { label: string; yes: string; no: string }
  > = {
    mobilized: { label: "Mobilized", yes: "Mobilized", no: "Waiting" },
    subscribed: { label: "Email", yes: "Subscribed", no: "Unsubscribed" },
    hasReason: { label: "Reason", yes: "Has reason", no: "No reason" },
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        aria-label="Search name, email, or phone"
        placeholder="Search name, email, or phone"
        maxLength={200}
        className="rounded border border-zinc-300 px-2 py-1 text-sm w-56"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <MultiSelectFilter
        label="Organization"
        options={organizations?.map((o) => ({ value: o.id, label: o.name }))}
        selected={filter.organizationIds ?? []}
        onChange={(ids) => set("organizationIds", ids)}
      />
      <MultiSelectFilter
        label="Link"
        options={links && linkOptions(links, organizationName)}
        selected={filter.sourceLinkIds ?? []}
        onChange={(ids) => set("sourceLinkIds", ids)}
      />
      <MultiSelectFilter
        label="Invite"
        options={INVITE_STATES.map((state) => ({
          value: state,
          label: INVITE_STATE_LABELS[state],
        }))}
        selected={filter.inviteStates ?? []}
        onChange={(states) => set("inviteStates", states)}
      />
      <MultiSelectFilter
        label="Spam"
        options={SPAM_STATUS_VALUES.map((status) => ({
          value: status,
          label: SPAM_STATUSES[status].label,
        }))}
        selected={filter.spamStatuses ?? []}
        onChange={(statuses) => set("spamStatuses", statuses)}
      />
      <MultiSelectFilter
        label="Tag"
        options={tags?.map((tag) => ({ value: tag.id, label: tag.name }))}
        selected={filter.tagIds ?? []}
        onChange={(ids) => set("tagIds", ids)}
      />
      {BOOLEAN_FIELDS.map((key) => (
        <BooleanFilter
          key={key}
          {...booleanFilters[key]}
          value={filter[key]}
          onChange={(value) => set(key, value)}
        />
      ))}
      <label className="flex items-center gap-1 text-sm text-zinc-700">
        Joined
        <input
          type="date"
          aria-label="Joined on or after"
          className="rounded border border-zinc-300 px-1 py-0.5"
          value={toDateInput(filter.joinedFrom)}
          onChange={(e) => {
            const joinedFrom = fromDateInput(e.target.value);
            if (joinedFrom.ok) set("joinedFrom", joinedFrom.value ?? undefined);
          }}
        />
        –
        <input
          type="date"
          aria-label="Joined on or before"
          className="rounded border border-zinc-300 px-1 py-0.5"
          value={toEndDateInput(filter.joinedBefore)}
          onChange={(e) => {
            const joinedBefore = fromEndDateInput(e.target.value);
            if (joinedBefore.ok) {
              set("joinedBefore", joinedBefore.value ?? undefined);
            }
          }}
        />
      </label>
      {filter.referrerIds?.length ? (
        <span className="flex items-center gap-1 rounded bg-zinc-200 px-2 py-1 text-sm">
          Referred by{" "}
          {filter.referrerIds.length === 1
            ? "one entry"
            : `${filter.referrerIds.length} entries`}
          <button
            type="button"
            aria-label="Clear referrer filter"
            title="Clear referrer filter"
            onClick={() => set("referrerIds", undefined)}
          >
            <X size={14} />
          </button>
        </span>
      ) : null}
      {!sameFilter(filter, INITIAL_WAITLIST_FILTER) && (
        <button
          type="button"
          aria-label="Clear filters"
          title="Clear filters"
          className={ICON_BUTTON_CLASS}
          onClick={() => {
            setSearch("");
            onChange(INITIAL_WAITLIST_FILTER);
          }}
        >
          <FilterX size={16} />
        </button>
      )}
    </div>
  );
};

export default WaitlistFilters;
