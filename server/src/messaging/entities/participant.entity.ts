import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Conversation } from "./conversation.entity";
import { Message } from "./message.entity";

export enum ParticipantRole {
  Admin = "admin",
  Member = "member",
  Owner = "owner",
}

export enum ParticipantState {
  Invited = "invited",
  Joined = "joined",
}

@Entity()
@Unique(["conversation", "user"])
export class Participant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Conversation, (conversation) => conversation.participants, {
    nullable: false,
    onDelete: "CASCADE",
  })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  conversation: Relation<Conversation>;

  @ManyToOne(() => User, (user) => user.participants, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "userId" })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

  @Column({ type: "enum", enum: ParticipantRole, enumName: "ParticipantRole" })
  @ApiProperty({ enum: ParticipantRole, enumName: "ParticipantRole" })
  role: ParticipantRole;

  @ManyToOne(() => Message, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "lastReadMessageId" })
  @ApiPropertyOptional({ type: () => Message })
  lastReadMessage?: Relation<Message>;

  @Column({
    type: "enum",
    enum: ParticipantState,
    enumName: "ParticipantState",
    default: ParticipantState.Joined,
  })
  @ApiProperty({ enum: ParticipantState, enumName: "ParticipantState" })
  state: ParticipantState;

  @Column({ type: "timestamptz" })
  joinedAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;
}
