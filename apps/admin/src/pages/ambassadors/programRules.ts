import type {
  AmbassadorProgramMemberDto,
  UserDto,
} from "@alliance/shared/client/types.gen";

export enum ProgramSection {
  Invited = "invited",
  Active = "active",
}

export const SECTION: Record<
  ProgramSection,
  {
    title: string;
    empty: string;
    addLabel: string;
    removeLabel: string;
    has: (member: AmbassadorProgramMemberDto) => boolean;
    flag: { invited: boolean } | { activeParticipant: boolean };
    unflag: { invited: boolean } | { activeParticipant: boolean };
  }
> = {
  [ProgramSection.Invited]: {
    title: "Invited",
    empty: "No invited members yet.",
    addLabel: "Add invited member",
    removeLabel: "Remove invited",
    has: (member) => member.invited,
    flag: { invited: true },
    unflag: { invited: false },
  },
  [ProgramSection.Active]: {
    title: "Active participants",
    empty: "No active participants yet.",
    addLabel: "Add participant",
    removeLabel: "Remove participant",
    has: (member) => member.activeParticipant,
    flag: { activeParticipant: true },
    unflag: { activeParticipant: false },
  },
};

export const PICKER_LIMIT = 40;

export const memberDisplayName = (
  user: Pick<UserDto, "id" | "name" | "email">,
) => user.name?.trim() || user.email || `User #${user.id}`;

/** Search over name, email and tag names. */
export const matchesRecord = (
  member: AmbassadorProgramMemberDto,
  q: string,
) => {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const tags = (member.user.tags ?? []).map((tag) => tag.name).join(" ");
  return `${member.user.name ?? ""} ${member.user.email ?? ""} ${tags}`
    .toLowerCase()
    .includes(term);
};

/** Pool members not yet in the section that match the search, capped for the picker. */
export const pickerOptions = (params: {
  pool: readonly UserDto[];
  excluded: ReadonlySet<number>;
  q: string;
}) => {
  const term = params.q.trim().toLowerCase();
  return params.pool
    .filter((user) => !params.excluded.has(user.id))
    .filter((user) =>
      `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(term),
    )
    .slice(0, PICKER_LIMIT);
};

/** The active participants' current targets minus what they have already recruited toward them. */
export const remainingCurrentTarget = (
  participants: readonly AmbassadorProgramMemberDto[],
) => {
  const goals = participants.flatMap((member) =>
    member.inviteStats?.currentGoal ? [member.inviteStats.currentGoal] : [],
  );
  const target = goals.reduce(
    (total, goal) => total + goal.goal.targetSuccessfulRecruits,
    0,
  );
  const successful = goals.reduce(
    (total, goal) => total + goal.stats.goalSuccessfulRecruits,
    0,
  );
  return Math.max(0, target - successful);
};

/** An interaction's date is a calendar date with no time. */
export const interactionDay = (date: string) => new Date(`${date}T00:00`);
