import { queryLocalDb } from "./lib/local-db";

const FLAGS = [
  { column: "onboarding", code: "Onb" },
  { column: "shouldCompleteAfterDeadline", code: "Etern" },
  { column: "preventCompletion", code: "NoFin" },
  { column: "publicOnly", code: "PubOnly" },
  { column: "optional", code: "Opt" },
  { column: "isForumParticipationAction", code: "ForumPart" },
] as const;

type ActionFlag = (typeof FLAGS)[number]["column"];

interface ActionRow extends Record<ActionFlag, boolean> {
  id: number;
  name: string;
  createdAt: string;
  releasedAt: string;
  status: string;
  archived: boolean;
  usersJoined: number;
  usersCompleted: number;
}

const QUERY = `
  SELECT
    a.id,
    a.name,
    a."createdAt",
    a.archived,
    a."usersJoined",
    a."usersCompleted",
    ${FLAGS.map((flag) => `a."${flag.column}"`).join(",\n    ")},
    release.date AS "releasedAt",
    COALESCE(current_event."newStatus", 'draft') AS status
  FROM action a
  LEFT JOIN LATERAL (
    SELECT e.date
    FROM action_event e
    WHERE e."actionId" = a.id AND e."newStatus" = 'member_action'
    ORDER BY e.date
    LIMIT 1
  ) release ON true
  LEFT JOIN LATERAL (
    SELECT e."newStatus"
    FROM action_event e
    WHERE e."actionId" = a.id AND e.date < now()
    ORDER BY e.date DESC
    LIMIT 1
  ) current_event ON true
  WHERE a."usersJoined" > 0 AND release.date IS NOT NULL
  ORDER BY release.date NULLS LAST, a."createdAt"
`;

const formatDate = (timestamp: string): string => timestamp.slice(0, 10);

const formatFlags = (row: ActionRow): string =>
  FLAGS.filter((flag) => row[flag.column])
    .map((flag) => flag.code)
    .join(" ");

const formatParticipation = (row: ActionRow): string => {
  const percent = Math.round((row.usersCompleted / row.usersJoined) * 100);
  return `${String(percent).padStart(3)}% (${row.usersCompleted}/${row.usersJoined})`;
};

function main(): void {
  const rows = queryLocalDb<ActionRow>(QUERY);
  const flagWidth = Math.max(
    "flags".length,
    ...rows.map((row) => formatFlags(row).length),
  );

  console.log(
    [
      "id".padStart(4),
      "released".padEnd(10),
      "created".padEnd(10),
      "status".padEnd(13),
      "participation".padEnd(16),
      "flags".padEnd(flagWidth),
      "name",
    ].join("  "),
  );
  for (const row of rows) {
    console.log(
      [
        String(row.id).padStart(4),
        formatDate(row.releasedAt).padEnd(10),
        formatDate(row.createdAt).padEnd(10),
        row.status.padEnd(13),
        formatParticipation(row).padEnd(16),
        formatFlags(row).padEnd(flagWidth),
        row.archived ? `${row.name} (archived)` : row.name,
      ].join("  "),
    );
  }
  console.log(`\n${rows.length} released actions with participation`);
}

main();
