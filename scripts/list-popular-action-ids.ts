/*
 * Popularity blends two percentile ranks — completion rate and completion
 * count — so a small action everyone finished doesn't outrank a large one, and
 * neither does a big action most people skipped.
 */
import { queryLocalDb } from "./lib/local-db";

const QUERY = `
  SELECT id
  FROM (
    SELECT
      a.id,
      percent_rank() OVER (
        ORDER BY a."usersCompleted"::float / a."usersJoined"
      ) + percent_rank() OVER (ORDER BY a."usersCompleted") AS score
    FROM action a
    WHERE a."usersJoined" > 0
      AND NOT a.onboarding
      AND EXISTS (
        SELECT 1 FROM action_event e
        WHERE e."actionId" = a.id AND e."newStatus" = 'member_action'
      )
  ) ranked
  ORDER BY score DESC, id
`;

for (const row of queryLocalDb<{ id: number }>(QUERY)) {
  console.log(row.id);
}
