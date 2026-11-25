import { z } from "zod";
import type { Queryable } from "./advisory-lock";

/**
 * Numbers a recomputation from the `BIGSERIAL` column's own sequence, which
 * issues them in order across sessions. Take it before the first read, so the
 * computation sees every input committed before it took its number, and write
 * only over a smaller stored number.
 */
export async function startComputation(params: {
  manager: Queryable;
  table: string;
  column: string;
}): Promise<string> {
  const [{ computation }] = z
    .array(z.object({ computation: z.string() }))
    .length(1)
    .parse(
      await params.manager.query(
        `SELECT nextval(pg_get_serial_sequence($1, $2))::text AS computation`,
        [params.table, params.column],
      ),
    );
  return computation;
}
