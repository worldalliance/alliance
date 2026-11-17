export type Queryable = {
  readonly queryRunner?: { readonly isTransactionActive: boolean };
  query(sql: string, parameters: unknown[]): Promise<unknown>;
};

// Outside a transaction a lock ends with its own statement.
export function assertTransaction(manager: Pick<Queryable, "queryRunner">) {
  if (!manager.queryRunner?.isTransactionActive) {
    throw new Error("locks need an active transaction");
  }
}

/**
 * Holds a Postgres advisory lock on `key` until the transaction ends. Throws
 * outside a transaction.
 */
export async function lockUntilCommit(
  manager: Queryable,
  key: string,
): Promise<void> {
  assertTransaction(manager);
  await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    key,
  ]);
}
