import {
  AmbassadorProgramMemberDto,
  CreateAmbassadorProgramInteractionDto,
  UserDto,
} from "@alliance/shared/client";
import { todayDateInputValue } from "@alliance/shared/lib/dateInput";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { CalendarDays, Plus } from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router";
import { memberDisplayName } from "./format";
import { InviteGoalStatsPanel } from "./InviteGoalStatsPanel";
import { ProgramSection, sectionConfig } from "./programSection";

const formatEntryDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));

const MemberBadges: React.FC<{ user: UserDto }> = ({ user }) => {
  const tags = [...(user.tags ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="flex flex-wrap gap-1">
      {user.ambassador && (
        <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Ambassador
        </span>
      )}
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600"
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
};

const InteractionForm: React.FC<{
  userId: number;
  onAdd: (body: CreateAmbassadorProgramInteractionDto) => Promise<void>;
  disabled?: boolean;
}> = ({ userId, onAdd, disabled = false }) => {
  const [text, setText] = useState("");
  const [interactionDate, setInteractionDate] = useState(todayDateInputValue());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    await onAdd({ userId, text: trimmed, interactionDate });
    setText("");
    setInteractionDate(todayDateInputValue());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
    >
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Add interaction note"
        rows={2}
        className="min-h-16 resize-y border border-zinc-300 px-3 py-2 text-sm"
      />
      <div className="flex flex-col gap-2 sm:w-44">
        <input
          type="date"
          value={interactionDate}
          onChange={(event) => setInteractionDate(event.target.value)}
          className="border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="inline-flex items-center justify-center gap-2 bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          <Plus size={16} />
          Add entry
        </button>
      </div>
    </form>
  );
};

export const ProgramMemberCard: React.FC<{
  member: AmbassadorProgramMemberDto;
  section: ProgramSection;
  onRemove: (userId: number, section: ProgramSection) => Promise<void>;
  onAddInteraction: (
    body: CreateAmbassadorProgramInteractionDto,
  ) => Promise<void>;
  mutationPending?: boolean;
}> = ({
  member,
  section,
  onRemove,
  onAddInteraction,
  mutationPending = false,
}) => {
  return (
    <article className="border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AvatarProfile pfp={member.user.profilePicture} size="medium" />
          <div className="min-w-0">
            <Link
              to={`/member/${member.userId}`}
              className="font-semibold text-zinc-900 hover:underline"
            >
              {memberDisplayName(member.user)}
            </Link>
            <p className="truncate text-sm text-zinc-500">
              {member.user.email}
            </p>
            <div className="mt-2">
              <MemberBadges user={member.user} />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onRemove(member.userId, section)}
          disabled={mutationPending}
          className="self-start border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
        >
          {sectionConfig[section].removeLabel}
        </button>
      </div>

      <div className="mt-4">
        <InteractionForm
          userId={member.userId}
          onAdd={onAddInteraction}
          disabled={mutationPending}
        />
      </div>

      {section === "active" && <InviteGoalStatsPanel member={member} />}

      <div className="mt-4 border-t border-zinc-200 pt-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
          <CalendarDays size={16} />
          Interactions
        </div>
        {member.interactions.length ? (
          <div className="space-y-2">
            {member.interactions.map((interaction) => (
              <div
                key={interaction.id}
                className="border border-zinc-100 bg-zinc-50 px-3 py-2"
              >
                <p className="text-xs font-medium text-zinc-500">
                  {formatEntryDate(interaction.interactionDate)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
                  {interaction.text}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No interactions yet.</p>
        )}
      </div>
    </article>
  );
};
