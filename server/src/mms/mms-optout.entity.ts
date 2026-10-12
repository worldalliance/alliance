import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import { phoneNumberTransformer } from "src/utils/phone";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity()
export class MmsOptout {
  @PrimaryGeneratedColumn("uuid")
  @ApiProperty()
  id: string;

  @Column({
    comment: "E.164 format (+15551234567)",
    transformer: phoneNumberTransformer,
  })
  @ApiProperty()
  phoneNumber: string;

  @Column()
  @ApiProperty()
  reason: string;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  updatedAt: Date;

  @Column()
  @ApiProperty()
  rawBody: string;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @ApiPropertyOptional({ type: () => User })
  user?: Relation<User>;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
