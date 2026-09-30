import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/**
 * When each address last claimed a public waitlist email, for the per-address
 * and daily limits.
 */
@Entity()
export class WaitlistMailAllowance {
  @PrimaryColumn({ type: "citext" })
  email: string;

  @Index()
  @Column({ type: "timestamptz" })
  claimedAt: Date;
}
