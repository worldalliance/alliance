import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { MemberListVersion } from "./member-list-version.entity";

@Entity()
export class MemberListMember {
  @PrimaryColumn()
  versionId: number;

  @ManyToOne(() => MemberListVersion, { onDelete: "CASCADE" })
  @JoinColumn({ name: "versionId" })
  version?: Relation<MemberListVersion>;

  @Index()
  @PrimaryColumn()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;
}
