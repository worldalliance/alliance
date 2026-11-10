import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";

/** A single-use code that signs a member's app session into a webview. */
@Entity()
export class WebHandoff {
  /** The credential itself never reaches the database. */
  @PrimaryColumn({ type: "varchar" })
  codeHash: string;

  @Column({ type: "int" })
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;
}
