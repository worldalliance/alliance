import {
  AmbassadorInviteGoalWithStatsDto,
  AmbassadorInviteProjectionDto,
  AmbassadorProgramMemberDto,
  UserDto,
  userCreateAmbassadorProgramInteractionAdmin,
  userGetAmbassadorProgramAdmin,
  userListForGraphAdmin,
  userUpdateAmbassadorProgramMemberAdmin,
  userUpsertAmbassadorProgramMemberAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Plus,
  TrendingUp,
  UserCheck,
  UserPlus,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link } from "react-router";

type ProgramSection = "invited" | "active";

const sectionConfig: Record<
  ProgramSection,
  {
    title: string;
    empty: string;
    addLabel: string;
    removeLabel: string;
    icon: React.ReactNode;
  }
> = {
  invited: {
    title: "Invited",
    empty: "No invited members yet.",
    addLabel: "Add invited member",
    removeLabel: "Remove invited",
    icon: <UserPlus size={18} />,
  },
  active: {
    title: "Active participants",
    empty: "No active participants yet.",
    addLabel: "Add participant",
    removeLabel: "Remove participant",
    icon: <UserCheck size={18} />,
  },
};

const todayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const memberDisplayName = (user: Pick<UserDto, "id" | "name" | "email">) =>
  user.name?.trim() || user.email || `User #${user.id}`;

const formatEntryDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));

const formatGoalDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const formatGeneratedAt = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

const goalPeriodLabel = (goal: AmbassadorInviteGoalWithStatsDto) =>
  `${formatGoalDate(goal.goal.startAt)} - ${formatGoalDate(goal.goal.dueAt)}`;

const numberLabel = (value: number) => value.toLocaleString();

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
  onAdd: (body: {
    userId: number;
    text: string;
    interactionDate: string;
  }) => Promise<void>;
  disabled?: boolean;
}> = ({ userId, onAdd, disabled = false }) => {
  const [text, setText] = useState("");
  const [interactionDate, setInteractionDate] = useState(todayInputValue());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    await onAdd({ userId, text: trimmed, interactionDate });
    setText("");
    setInteractionDate(todayInputValue());
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

const GoalPeriodStats: React.FC<{
  goal: AmbassadorInviteGoalWithStatsDto;
  label?: string;
}> = ({ goal, label }) => (
  <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-800">
          {label ?? goalPeriodLabel(goal)}
        </p>
        {label && (
          <p className="text-xs text-zinc-500">{goalPeriodLabel(goal)}</p>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Target {numberLabel(goal.goal.targetSuccessfulRecruits)}
      </p>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div>
        <p className="text-xs text-zinc-500">Created</p>
        <p className="font-semibold tabular-nums">
          {numberLabel(goal.stats.totalInvitesSent)}
        </p>
      </div>
      <div>
        <p className="text-xs text-zinc-500">Accepted</p>
        <p className="font-semibold tabular-nums">
          {numberLabel(goal.stats.totalAcceptedInvites)}
        </p>
      </div>
      <div>
        <p className="text-xs text-zinc-500">Successful</p>
        <p className="font-semibold tabular-nums">
          {numberLabel(goal.stats.goalSuccessfulRecruits)} /{" "}
          {numberLabel(goal.goal.targetSuccessfulRecruits)}
        </p>
      </div>
    </div>
  </div>
);

const GrowthProjectionPanel: React.FC<{
  projection?: AmbassadorInviteProjectionDto;
  activeParticipants: AmbassadorProgramMemberDto[];
}> = ({ projection, activeParticipants }) => {
  const activeGoals = activeParticipants
    .map((member) => member.inviteStats?.currentGoal)
    .filter((goal): goal is AmbassadorInviteGoalWithStatsDto => Boolean(goal));
  const currentTarget = activeGoals.reduce(
    (total, goal) => total + goal.goal.targetSuccessfulRecruits,
    0,
  );
  const currentSuccessful = activeGoals.reduce(
    (total, goal) => total + goal.stats.goalSuccessfulRecruits,
    0,
  );
  const remainingCurrentTarget = Math.max(0, currentTarget - currentSuccessful);
  const points = projection?.points ?? [];

  return (
    <section className="border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} />
            <h2 className="text-lg font-semibold text-zinc-900">
              Projected growth
            </h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Estimate of successful recruits expected from active and upcoming
            ambassador invite goals.
          </p>
        </div>
        {projection && (
          <p className="text-xs text-zinc-500">
            Updated {formatGeneratedAt(projection.generatedAt)}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Active goal target left</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {numberLabel(remainingCurrentTarget)}
          </p>
        </div>
        {points.map((point) => (
          <div
            key={point.date}
            className="border border-zinc-200 bg-zinc-50 px-3 py-2"
          >
            <p className="text-xs text-zinc-500">
              By {formatGoalDate(point.date)}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {numberLabel(point.projectedSuccessfulRecruits)}
            </p>
          </div>
        ))}
        {!points.length && (
          <div className="border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500">
            No active or upcoming invite goals to project.
          </div>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Calculation reminder: for every active or future goal, this estimates
        the remaining successful recruits not yet earned, spreads them evenly
        from today or the goal start date through the due date, then sums those
        estimates for each checkpoint.
      </p>
    </section>
  );
};

const InviteGoalStatsPanel: React.FC<{
  member: AmbassadorProgramMemberDto;
}> = ({ member }) => {
  if (!member.inviteStats) {
    return null;
  }

  const { currentGoal, pastGoals, totals, upcomingGoals } = member.inviteStats;

  return (
    <div className="mt-4 border-t border-zinc-200 pt-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
        <UserCheck size={16} />
        Ambassador invite goals
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Created total</p>
          <p className="font-semibold tabular-nums">
            {numberLabel(totals.totalInvitesSent)}
          </p>
        </div>
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Accepted total</p>
          <p className="font-semibold tabular-nums">
            {numberLabel(totals.totalAcceptedInvites)}
          </p>
        </div>
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Successful total</p>
          <p className="font-semibold tabular-nums">
            {numberLabel(totals.totalSuccessfulRecruits)}
          </p>
        </div>
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Goal periods</p>
          <p className="font-semibold tabular-nums">
            {numberLabel(
              (currentGoal ? 1 : 0) + pastGoals.length + upcomingGoals.length,
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {currentGoal ? (
          <GoalPeriodStats goal={currentGoal} label="Current goal" />
        ) : (
          <div className="border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500">
            No current ambassador invite goal.
          </div>
        )}

        {pastGoals.length > 0 && (
          <details className="border border-zinc-200 bg-white px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-zinc-700">
              Past growth periods ({pastGoals.length})
            </summary>
            <div className="mt-2 space-y-2">
              {pastGoals.map((goal) => (
                <GoalPeriodStats key={goal.goal.id} goal={goal} />
              ))}
            </div>
          </details>
        )}

        {upcomingGoals.length > 0 && (
          <details className="border border-zinc-200 bg-white px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-zinc-700">
              Upcoming goals ({upcomingGoals.length})
            </summary>
            <div className="mt-2 space-y-2">
              {upcomingGoals.map((goal) => (
                <GoalPeriodStats key={goal.goal.id} goal={goal} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

const ProgramMemberCard: React.FC<{
  member: AmbassadorProgramMemberDto;
  section: ProgramSection;
  onRemove: (userId: number, section: ProgramSection) => Promise<void>;
  onAddInteraction: (body: {
    userId: number;
    text: string;
    interactionDate: string;
  }) => Promise<void>;
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

const ProgramSectionPanel: React.FC<{
  section: ProgramSection;
  members: AmbassadorProgramMemberDto[];
  memberPool: UserDto[];
  existingUserIds: Set<number>;
  onAdd: (userId: number, section: ProgramSection) => Promise<void>;
  onRemove: (userId: number, section: ProgramSection) => Promise<void>;
  onAddInteraction: (body: {
    userId: number;
    text: string;
    interactionDate: string;
  }) => Promise<void>;
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

const AmbassadorProgramPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");

  const dashboardQuery = useQuery({
    queryKey: queryKeys.ambassadorProgramAdmin(),
    queryFn: () =>
      userGetAmbassadorProgramAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });

  const membersQuery = useQuery({
    queryKey: ["userListForGraphAdmin"],
    queryFn: () =>
      userListForGraphAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });

  const invalidateDashboard = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.ambassadorProgramAdmin(),
    });

  const upsertMember = useMutation({
    mutationFn: (body: {
      userId: number;
      invited?: boolean;
      activeParticipant?: boolean;
    }) =>
      userUpsertAmbassadorProgramMemberAdmin({
        body,
        throwOnError: true,
      }).then((response) => response.data),
    onSuccess: invalidateDashboard,
  });

  const updateMember = useMutation({
    mutationFn: (params: {
      userId: number;
      body: { invited?: boolean; activeParticipant?: boolean };
    }) =>
      userUpdateAmbassadorProgramMemberAdmin({
        path: { userId: params.userId },
        body: params.body,
        throwOnError: true,
      }).then((response) => response.data),
    onSuccess: invalidateDashboard,
  });

  const createInteraction = useMutation({
    mutationFn: (body: {
      userId: number;
      text: string;
      interactionDate: string;
    }) =>
      userCreateAmbassadorProgramInteractionAdmin({
        body,
        throwOnError: true,
      }).then((response) => response.data),
    onSuccess: invalidateDashboard,
  });

  const records = useMemo(
    () => dashboardQuery.data?.members ?? [],
    [dashboardQuery.data?.members],
  );
  const memberPool = useMemo(
    () => membersQuery.data ?? [],
    [membersQuery.data],
  );
  const filterTerm = filter.trim().toLowerCase();

  const filteredRecords = useMemo(() => {
    if (!filterTerm) {
      return records;
    }
    return records.filter((record) => {
      const tags = (record.user.tags ?? []).map((tag) => tag.name).join(" ");
      return `${record.user.name ?? ""} ${record.user.email ?? ""} ${tags}`
        .toLowerCase()
        .includes(filterTerm);
    });
  }, [filterTerm, records]);

  const invited = filteredRecords.filter((member) => member.invited);
  const active = filteredRecords.filter((member) => member.activeParticipant);
  const invitedIds = useMemo(
    () =>
      new Set(records.filter((member) => member.invited).map((m) => m.userId)),
    [records],
  );
  const activeIds = useMemo(
    () =>
      new Set(
        records
          .filter((member) => member.activeParticipant)
          .map((member) => member.userId),
      ),
    [records],
  );

  const pending =
    upsertMember.isPending ||
    updateMember.isPending ||
    createInteraction.isPending;

  const handleAdd = async (userId: number, section: ProgramSection) => {
    switch (section) {
      case "invited":
        await upsertMember.mutateAsync({ userId, invited: true });
        break;
      case "active":
        await upsertMember.mutateAsync({ userId, activeParticipant: true });
        break;
      default:
        throw new Error(`unknown program section: ${section satisfies never}`);
    }
  };

  const handleRemove = async (userId: number, section: ProgramSection) => {
    switch (section) {
      case "invited":
        await updateMember.mutateAsync({ userId, body: { invited: false } });
        break;
      case "active":
        await updateMember.mutateAsync({
          userId,
          body: { activeParticipant: false },
        });
        break;
      default:
        throw new Error(`unknown program section: ${section satisfies never}`);
    }
  };

  const error =
    dashboardQuery.error ||
    membersQuery.error ||
    upsertMember.error ||
    updateMember.error ||
    createInteraction.error;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-6 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Ambassador program</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Track invite outreach, active participants, and dated CRM notes.
            </p>
          </div>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter records"
            className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm lg:w-80"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Invited", records.filter((member) => member.invited).length],
            [
              "Active",
              records.filter((member) => member.activeParticipant).length,
            ],
            [
              "Interactions",
              records.reduce(
                (total, member) => total + member.interactions.length,
                0,
              ),
            ],
          ].map(([label, value]) => (
            <div key={label} className="border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <GrowthProjectionPanel
          projection={dashboardQuery.data?.projection}
          activeParticipants={active}
        />

        {error && (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Something went wrong while saving or loading the ambassador program.
          </div>
        )}

        <div
          className={cn(
            "grid grid-cols-1 gap-6 xl:grid-cols-2",
            dashboardQuery.isLoading || membersQuery.isLoading
              ? "opacity-60"
              : "opacity-100",
          )}
        >
          <ProgramSectionPanel
            section="invited"
            members={invited}
            memberPool={memberPool}
            existingUserIds={invitedIds}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onAddInteraction={async (body) => {
              await createInteraction.mutateAsync(body);
            }}
            mutationPending={pending}
          />
          <ProgramSectionPanel
            section="active"
            members={active}
            memberPool={memberPool}
            existingUserIds={activeIds}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onAddInteraction={async (body) => {
              await createInteraction.mutateAsync(body);
            }}
            mutationPending={pending}
          />
        </div>
      </div>
    </main>
  );
};

export default AmbassadorProgramPage;
