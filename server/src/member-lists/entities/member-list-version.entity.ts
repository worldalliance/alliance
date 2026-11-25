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
import { MemberList } from "./member-list.entity";

/**
 * One save of a list's membership, held in `MemberListMember` rows. Never
 * updated, apart from removing a deleted account's rows.
 */
@Entity()
export class MemberListVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: "uuid" })
  listId: string;

  @ManyToOne(() => MemberList, (list) => list.versions)
  @JoinColumn({ name: "listId" })
  list?: Relation<MemberList>;

  @Column({ type: "int", nullable: true })
  savedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "savedById" })
  savedBy?: Relation<User> | null;

  @CreateDateColumnTz()
  createdAt: Date;
}
