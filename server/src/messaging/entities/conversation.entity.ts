import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Community } from "src/community/entities/community.entity";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Message } from "./message.entity";
import { Participant } from "./participant.entity";

export enum ConversationType {
  Direct = "direct",
  Multiple = "multiple",
  Community = "community",
}

@Entity()
@Check(
  `("type" = 'direct' AND "communityId" IS NULL) OR ("type" = 'multiple' AND "communityId" IS NULL) OR ("type" = 'community' AND "communityId" IS NOT NULL)`,
)
@Unique(["community"])
export class Conversation {
  @PrimaryGeneratedColumn()
  @ApiProperty({ type: Number })
  id: number;

  @OneToMany(() => Message, (message) => message.conversation)
  @ApiProperty({ type: () => Message, isArray: true })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  messages: Relation<Message>[];

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ type: Date })
  updatedAt: Date;

  @OneToMany(() => Participant, (participant) => participant.conversation)
  @ApiProperty({ type: () => Participant, isArray: true })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  participants: Relation<Participant>[];

  @Column({
    type: "enum",
    enum: ConversationType,
    enumName: "ConversationType",
  })
  @ApiProperty({ enum: ConversationType, enumName: "ConversationType" })
  type: ConversationType;

  @Column()
  @ApiProperty({ type: String })
  title: string;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  photo: string | null;

  @ManyToOne(() => Community, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "communityId" })
  @ApiPropertyOptional({ type: () => Community })
  community?: Relation<Community>;
}
