import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** A named waitlist filter; its entries are recomputed whenever it's used. */
@Entity()
@Check("CHK_waitlist_cohort_name", `"name" ~ '[^[:space:]]'`)
export class WaitlistCohort {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true, where: '"deletedAt" IS NULL' })
  @Column({ type: "citext" })
  name: string;

  /** A `WaitlistEntryFilterDto`, parsed with `parseCohortFilter`. */
  @Column({ type: "jsonb" })
  filter: unknown;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
