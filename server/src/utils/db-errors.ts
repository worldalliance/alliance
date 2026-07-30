import { QueryFailedError } from 'typeorm';

/** Postgres SQLSTATE for a foreign key violation. */
const FOREIGN_KEY_VIOLATION = '23503';

export function isForeignKeyViolation(error: unknown): boolean {
  // node-postgres puts SQLSTATE on the thrown error itself; TypeORM's
  // QueryFailedError type does not declare it, hence the narrow cast.
  return (
    error instanceof QueryFailedError &&
    (error as { code?: string }).code === FOREIGN_KEY_VIOLATION
  );
}
