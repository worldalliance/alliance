import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { WaitlistEntry } from "./waitlist-entry.entity";
import { WaitlistTag } from "./waitlist-tag.entity";

@Entity()
export class WaitlistEntryTag {
  @PrimaryColumn()
  entryId: number;

  @ManyToOne(() => WaitlistEntry)
  @JoinColumn({ name: "entryId" })
  entry?: Relation<WaitlistEntry>;

  @Index()
  @PrimaryColumn()
  tagId: number;

  @ManyToOne(() => WaitlistTag, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tagId" })
  tag?: Relation<WaitlistTag>;

  @CreateDateColumnTz()
  createdAt: Date;
}
