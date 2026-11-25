import { lockUntilCommit, type Queryable } from "./advisory-lock";

describe("lockUntilCommit", () => {
  const manager = (isTransactionActive: boolean) => {
    const query = jest.fn(async () => []);
    const em: Queryable = { queryRunner: { isTransactionActive }, query };
    return { em, query };
  };

  it("locks the key inside a transaction", async () => {
    const { em, query } = manager(true);
    await lockUntilCommit(em, "key");
    expect(query).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["key"],
    );
  });

  it("throws outside a transaction", async () => {
    const { em, query } = manager(false);
    await expect(lockUntilCommit(em, "key")).rejects.toThrow(
      "locks need an active transaction",
    );
    expect(query).not.toHaveBeenCalled();
  });
});
