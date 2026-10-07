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

  @UpdateDateColumnTz()
  updatedAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
