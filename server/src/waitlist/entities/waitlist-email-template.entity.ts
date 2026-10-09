import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** A named subject and body staff start waitlist emails from. */
@Entity()
@Check("CHK_waitlist_email_template_name", `"name" ~ '[^[:space:]]'`)
export class WaitlistEmailTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: "citext" })
  name: string;

  @Column()
  subject: string;

  /** Markdown with `#{placeholder}`s. */
  @Column({ type: "text" })
  body: string;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
