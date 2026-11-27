import type {
  AmbassadorProgramMemberDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import { type RefObject, useId, useMemo, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useUpsertAmbassadorProgramMemberAdmin } from "../../lib/useAmbassadorProgramAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { ProgramMemberCard } from "./ProgramMemberCard";
import {
  memberDisplayName,
  PICKER_LIMIT,
  pickerOptions,
  ProgramSection,
  SECTION,
} from "./programRules";

function AddMember({
  section,
  pool,
  poolError,
  excluded,
  searchRef,
}: {
  section: ProgramSection;
  pool: readonly UserDto[];
  /** Why the member pool couldn't load, if it didn't. */
  poolError: string | null;
  excluded: ReadonlySet<number>;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState("");
  const [pickError, setPickError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const upsert = useUpsertAmbassadorProgramMemberAdmin();
  const options = useMemo(
    () => pickerOptions({ pool, excluded, q }),
    [pool, excluded, q],
  );

  return (
    <form
      noValidate
      className="flex flex-wrap items-start gap-3 rounded-card border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const userId = Number(picked);
        if (!picked || !options.some((user) => user.id === userId)) {
          setPickError("Choose a member to add");
          return;
        }
        setRefusal(null);
        upsert.mutate(
          { userId, ...SECTION[section].flag },
          {
            onSuccess: () => {
              setPicked("");
              setQ("");
            },
            onError: (error) =>
              setRefusal(
                adminRefusalMessage(error, "Couldn't add the member."),
              ),
          },
        );
      }}
    >
      <Field label="Search members" className="min-w-40 flex-1">
        {(control) => (
          <Input
            {...control}
            ref={searchRef}
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        )}
      </Field>
      <Field
        label="Member"
        help={`Up to ${PICKER_LIMIT} matches.`}
        error={poolError ?? pickError}
        className="min-w-40 flex-1"
      >
        {(control) => (
          <Select
            {...control}
            value={picked}
            onChange={(event) => {
              setPicked(event.target.value);
              setPickError(null);
            }}
          >
            <option value="">Select member</option>
            {options.map((user) => (
              <option key={user.id} value={user.id}>
                {memberDisplayName(user)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="invisible">
          &nbsp;
        </span>
        <Button
          variant={ButtonVariant.Default}
          type="submit"
          busy={upsert.isPending}
        >
          {SECTION[section].addLabel}
        </Button>
      </div>
      <InlineError message={refusal} className="basis-full" />
    </form>
  );
}

export function ProgramSectionList({
  section,
  members,
  total,
  pool,
  poolError,
  removingIds,
  onRemove,
}: {
  section: ProgramSection;
  /** The section's members the search matches. */
  members: readonly AmbassadorProgramMemberDto[];
  /** Everyone in the section, searched or not. */
  total: readonly AmbassadorProgramMemberDto[];
  pool: readonly UserDto[];
  poolError: string | null;
  removingIds: ReadonlySet<number>;
  /** Calls `onRemoved` once the member has left the section. */
  onRemove: (member: AmbassadorProgramMemberDto, onRemoved: () => void) => void;
}) {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const focus = useFocusAfterRemoval({
    ids: members.map((member) => member.userId),
    fallback: searchRef,
  });
  const excluded = useMemo(
    () => new Set(total.map((member) => member.userId)),
    [total],
  );
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 id={titleId} className="text-heading font-semibold">
          {SECTION[section].title}
        </h2>
        <span className="text-fg-muted tabular-nums">
          {formatCount(members.length)}
        </span>
      </div>
      <AddMember
        section={section}
        pool={pool}
        poolError={poolError}
        excluded={excluded}
        searchRef={searchRef}
      />
      {members.length === 0 ? (
        <p className="rounded-card border border-dashed border-line p-card text-fg-muted">
          {SECTION[section].empty}
        </p>
      ) : (
        members.map((member) => (
          <div key={member.id} {...focus.row(member.userId)}>
            <ProgramMemberCard
              member={member}
              section={section}
              removing={removingIds.has(member.userId)}
              onRemove={() => onRemove(member, focus.removing(member.userId))}
            />
          </div>
        ))
      )}
    </section>
  );
}
