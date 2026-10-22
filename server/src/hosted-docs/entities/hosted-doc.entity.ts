import { ApiProperty } from "@nestjs/swagger";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
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

@Entity()
export class HostedDoc {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Index({ unique: true, where: '"deletedAt" IS NULL' })
  @Column({ type: "citext" })
  @ApiProperty()
  slug: string;

  @Column({ type: "text", default: "" })
  @ApiProperty()
  notes: string;

  @Column()
  s3Key: string;

  @Column({ default: 0 })
  @ApiProperty()
  views: number;

  @Column({ nullable: true })
  uploadedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "uploadedById" })
  uploadedBy?: Relation<User> | null;

  @Column({ nullable: true })
  fileReplacedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "fileReplacedById" })
  fileReplacedBy?: Relation<User> | null;

  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  fileReplacedAt: Date | null;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
