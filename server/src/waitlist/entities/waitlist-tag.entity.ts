import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** A staff-kept list of waitlist entries; nothing joins it automatically. */
@Entity()
@Check("CHK_waitlist_tag_name", `"name" ~ '[^[:space:]]'`)
export class WaitlistTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: "citext" })
  name: string;

  @CreateDateColumnTz()
  createdAt: Date;
}
