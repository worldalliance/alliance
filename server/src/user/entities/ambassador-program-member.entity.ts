import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow } from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { AmbassadorProgramInteraction } from "./ambassador-program-interaction.entity";
import { User } from "./user.entity";

@Entity()
@Index(["user"], { unique: true })
export class AmbassadorProgramMember {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  invited: boolean;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  activeParticipant: boolean;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  @Type(() => Date)
  @Allow()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ type: Date })
  @Type(() => Date)
  @Allow()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @ApiProperty({ type: () => User })
  @Type(() => User)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

  @RelationId((member: AmbassadorProgramMember) => member.user)
  @ApiProperty()
  @Type(() => Number)
  @Allow()
  userId: number;

  @OneToMany(
    () => AmbassadorProgramInteraction,
    (interaction) => interaction.programMember,
  )
  @ApiProperty({ type: () => AmbassadorProgramInteraction, isArray: true })
  @Type(() => AmbassadorProgramInteraction)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  interactions: Relation<AmbassadorProgramInteraction>[];
}
