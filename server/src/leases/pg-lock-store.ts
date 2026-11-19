import { Injectable } from "@nestjs/common";
import type { LockAcquireResult, LockStore } from "@nestjs/locks";
import { LocksStorage } from "@nestjs/locks";
import { DataSource } from "typeorm";

/**
 * Each method is one statement on the database's clock, so a lease holds no
 * connection between calls and every process agrees on when it expires.
 */
@Injectable()
export class PgLockStore implements LockStore {
  constructor(
    private readonly dataSource: DataSource,
    storage: LocksStorage,
  ) {
    storage.registerSource(this);
  }

  async acquire(
    key: string,
    owner: string,
    ttl: number,
  ): Promise<LockAcquireResult> {
    const rows: { fencingToken: string }[] = await this.dataSource.query(
      `INSERT INTO lease (key, owner, "fencingToken", "expiresAt")
       VALUES ($1, $2, 1, clock_timestamp() + $3::bigint * interval '1 millisecond')
       ON CONFLICT (key) DO UPDATE
         SET owner = EXCLUDED.owner,
             "fencingToken" = lease."fencingToken" + 1,
             "expiresAt" = EXCLUDED."expiresAt"
         WHERE lease.owner IS NULL OR lease."expiresAt" <= clock_timestamp()
       RETURNING "fencingToken"`,
      [key, owner, ttl],
    );
    return rows.length === 0
      ? { acquired: false }
      : { acquired: true, fencingToken: Number(rows[0].fencingToken) };
  }

  async renew(key: string, owner: string, ttl: number): Promise<boolean> {
    const [, updated]: [unknown[], number] = await this.dataSource.query(
      `UPDATE lease
       SET "expiresAt" = clock_timestamp() + $3::bigint * interval '1 millisecond'
       WHERE key = $1 AND owner = $2 AND "expiresAt" > clock_timestamp()`,
      [key, owner, ttl],
    );
    return updated === 1;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const [, updated]: [unknown[], number] = await this.dataSource.query(
      `UPDATE lease SET owner = NULL
       WHERE key = $1 AND owner = $2 AND "expiresAt" > clock_timestamp()`,
      [key, owner],
    );
    return updated === 1;
  }
}
