import { queryLocalDb } from "./lib/local-db";

const QUERY = `
  SELECT a.id
  FROM action a
  JOIN LATERAL (
    SELECT min(e.date) AS date
    FROM action_event e
    WHERE e."actionId" = a.id AND e."newStatus" = 'member_action'
  ) release ON release.date IS NOT NULL
  ORDER BY release.date DESC, a.id DESC
`;

for (const row of queryLocalDb<{ id: number }>(QUERY)) {
  console.log(row.id);
}
