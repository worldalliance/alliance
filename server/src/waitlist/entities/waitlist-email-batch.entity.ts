import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

/** One confirmed staff email, sent to recipients fixed when it was created. */
@Entity()
export class WaitlistEmailBatch {
  @PrimaryGeneratedColumn()
  id: number;

  /** The admin's key for the send request; repeating it creates nothing. */
  @Index({ unique: true })
  @Column({ type: "uuid" })
  requestId: string;

  @Column()
  subject: string;

  /** Markdown with `#{placeholder}`s, as staff wrote it. */
  @Column({ type: "text" })
  body: string;

  /** Marks each waiting recipient mobilized once the mail server accepts. */
  @Column()
  mobilize: boolean;

  @Column()
  includeClaimed: boolean;

  @Column({ nullable: true })
  staffUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "staffUserId" })
  staffUser?: Relation<User> | null;

  @CreateDateColumnTz()
  createdAt: Date;
}
