import { ParticipantRole } from "@alliance/common/participantRole";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Conversation } from "./conversation.entity";
import { Message } from "./message.entity";

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
  conversation?: Relation<Conversation>;

  @ManyToOne(() => User, (user) => user.participants, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

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

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}

export function loadedParticipantConversation(
  participant: Participant,
): Relation<Conversation> {
  if (!participant.conversation) {
    throw new Error(`conversation of participant ${participant.id} not loaded`);
  }
  return participant.conversation;
}

export function loadedParticipantUser(
  participant: Participant,
): Relation<User> {
  if (!participant.user) {
    throw new Error(`user of participant ${participant.id} not loaded`);
  }
  return participant.user;
}
