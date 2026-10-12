import {
  AmbassadorProgramMemberDto,
  CreateAmbassadorProgramInteractionDto,
  UserDto,
} from "@alliance/shared/client";
import { Plus } from "lucide-react";
import React, { useMemo, useState } from "react";
import { memberDisplayName } from "./format";
import { ProgramMemberCard } from "./ProgramMemberCard";
import { ProgramSection, sectionConfig } from "./programSection";

const AddMemberControl: React.FC<{
  members: UserDto[];
  existingUserIds: Set<number>;
  onAdd: (userId: number) => Promise<void>;
  label: string;
  disabled?: boolean;
}> = ({ members, existingUserIds, onAdd, label, disabled = false }) => {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");

  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    return members
      .filter((member) => !existingUserIds.has(member.id))
      .filter((member) => {
        if (!term) {
          return true;
        }
        return `${member.name ?? ""} ${member.email ?? ""}`
          .toLowerCase()
          .includes(term);
      })
      .slice(0, 40);
  }, [existingUserIds, members, query]);

  const handleAdd = async () => {
    if (selectedUserId === "") {
      return;
    }
    await onAdd(selectedUserId);
    setSelectedUserId("");
    setQuery("");
  };

  return (
    <div className="grid grid-cols-1 gap-2 border border-zinc-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search member pool"
        className="border border-zinc-300 px-3 py-2 text-sm"
      />
      <select
        value={selectedUserId}
        onChange={(event) =>
          setSelectedUserId(
            event.target.value ? Number(event.target.value) : "",
          )
        }
        className="border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="">Select member</option>
        {options.map((member) => (
          <option key={member.id} value={member.id}>
            {memberDisplayName(member)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={disabled || selectedUserId === ""}
        className="inline-flex items-center justify-center gap-2 bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        <Plus size={16} />
        {label}
      </button>
    </div>
  );
};

export const ProgramSectionPanel: React.FC<{
  section: ProgramSection;
  members: AmbassadorProgramMemberDto[];
  memberPool: UserDto[];
  existingUserIds: Set<number>;
  onAdd: (userId: number, section: ProgramSection) => Promise<void>;
  onRemove: (userId: number, section: ProgramSection) => Promise<void>;
  onAddInteraction: (
    body: CreateAmbassadorProgramInteractionDto,
  ) => Promise<void>;
  mutationPending?: boolean;
}> = ({
  section,
  members,
  memberPool,
  existingUserIds,
  onAdd,
  onRemove,
  onAddInteraction,
  mutationPending = false,
}) => {
  const config = sectionConfig[section];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {config.icon}
          <h2 className="text-lg font-semibold text-zinc-900">
            {config.title}
          </h2>
          <span className="bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {members.length}
          </span>
        </div>
      </div>
      <AddMemberControl
        members={memberPool}
        existingUserIds={existingUserIds}
        onAdd={(userId) => onAdd(userId, section)}
        label={config.addLabel}
        disabled={mutationPending}
      />
      <div className="space-y-3">
        {members.map((member) => (
          <ProgramMemberCard
            key={member.id}
            member={member}
            section={section}
            onRemove={onRemove}
            onAddInteraction={onAddInteraction}
            mutationPending={mutationPending}
          />
        ))}
        {!members.length && (
          <div className="border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
            {config.empty}
          </div>
        )}
      </div>
    </section>
  );
};
