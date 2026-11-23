import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SuiteSplitVersion } from "./suite-split-version.entity";
import { SuiteSplit } from "./suite-split.entity";

/**
 * The exact versions a split's members are placed against: the split version
 * and every formula and member list version it reads, as they stood at
 * `pinnedAt`.
 */
@Entity()
export class SuiteSplitPin {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  suiteId: number;

  @ManyToOne(() => SuiteSplit)
  @JoinColumn({ name: "suiteId" })
  split?: Relation<SuiteSplit>;

  @Column()
  splitVersionId: number;

  @ManyToOne(() => SuiteSplitVersion)
  @JoinColumn({ name: "splitVersionId" })
  splitVersion?: Relation<SuiteSplitVersion>;

  @Column({ type: "integer", array: true })
  formulaVersionIds: number[];

  @Column({ type: "integer", array: true })
  listVersionIds: number[];

  /** Go-live: the `member_action` event's time, not when the pass ran. */
  @Column({ type: "timestamptz" })
  pinnedAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
