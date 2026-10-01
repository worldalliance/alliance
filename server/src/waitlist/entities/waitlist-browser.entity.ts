import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { WaitlistEntry } from "./waitlist-entry.entity";

/** A browser that joined the waitlist, by the cookie it was given. */
@Entity()
export class WaitlistBrowser {
  /** sha256, base64url. The cookie's token never reaches the database. */
  @PrimaryColumn()
  tokenHash: string;

  @Index()
  @Column()
  entryId: number;

  @ManyToOne(() => WaitlistEntry, { onDelete: "CASCADE" })
  @JoinColumn({ name: "entryId" })
  entry?: Relation<WaitlistEntry>;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
