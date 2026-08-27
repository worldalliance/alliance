import { QueryFailedError } from "typeorm";

/** Postgres SQLSTATEs. */
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";

function hasSqlState(error: unknown, sqlState: string): boolean {
  // node-postgres puts SQLSTATE on the thrown error itself; TypeORM's
  // QueryFailedError type does not declare it, hence the narrow cast.
  return (
    error instanceof QueryFailedError &&
    (error as { code?: string }).code === sqlState
  );
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasSqlState(error, FOREIGN_KEY_VIOLATION);
}

export function isUniqueViolation(error: unknown): boolean {
  return hasSqlState(error, UNIQUE_VIOLATION);
}
