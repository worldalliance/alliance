import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { MemberListVersion } from "./member-list-version.entity";

export const LIST_NAME_INDEX = "UQ_member_list_name";

/**
 * A staff-picked set of members that formulas read as `isOnList("<name>")`.
 * Its membership changes through immutable `MemberListVersion`s; the latest
 * is current.
 */
@Entity()
// Formulas print a list's name, so it is unique among lists that aren't deleted.
@Index(LIST_NAME_INDEX, ["name"], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class MemberList {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  /** Soft, so formula versions that read a deleted list still print its name. */
  @DeleteDateColumnTz()
  deletedAt: Date | null;

  @OneToMany(() => MemberListVersion, (version) => version.list)
  versions?: Relation<MemberListVersion>[];
}
