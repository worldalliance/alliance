import { ApiProperty } from "@nestjs/swagger";
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
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
@Index(["expoPushToken"], { unique: true, where: '"deletedAt" IS NULL' })
export class UserDevice {
  @PrimaryGeneratedColumn("uuid")
  @ApiProperty()
  id: string;

  @ManyToOne(() => User, (user) => user.devices, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @Column({ type: "varchar", nullable: true })
  deviceType: string | null;

  @Column({ type: "varchar", nullable: true })
  expoPushToken: string | null;

  /** The task badge count last sent; null when the device may lack the current one, so the next sync resends. */
  @Column({ type: "int", nullable: true })
  badgeCount: number | null;

  /**
   * When the computation behind `badgeCount` began. A send claims the device
   * only with a later start, so a slower, older computation can't overwrite
   * a newer count.
   */
  @Column({ type: "timestamptz", nullable: true })
  badgeCountComputedAt: Date | null;

  /** The installed build handles badge-only pushes quietly; older builds would show them. */
  @Column({ default: false })
  taskBadgePushes: boolean;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
