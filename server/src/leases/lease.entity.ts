import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * A lease from `PgLockStore`. Releasing one clears `owner` instead of deleting
 * the row, so `fencingToken` keeps growing across every holder of the key.
 */
@Entity()
export class Lease {
  @PrimaryColumn({ type: "text" })
  key: string;

  @Column({ type: "text", nullable: true })
  owner: string | null;

  @Column({ type: "bigint" })
  fencingToken: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;
}
