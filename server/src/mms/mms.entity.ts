import { ApiProperty } from "@nestjs/swagger";
import { DeleteDateColumnTz } from "src/datasources/basecolumns";
import type { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import type { MessageStatus } from "twilio/lib/rest/api/v2010/account/message";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "../datasources/basecolumns";

export enum MmsDirection {
  Inbound = "inbound",
  Outbound = "outbound",
}

export enum MmsKeyword {
  Stop = "stop",
  Start = "start",
}

@Entity()
@Index(["twilioSid"], {
  unique: true,
  where: `"direction" = 'inbound'`,
})
export class Mms {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column({
    comment:
      "Twilio recipient address; may be E.164, a short code, or a channel address",
  })
  @ApiProperty()
  to: string;

  @Column({
    comment:
      "Twilio sender identifier; may be E.164, a short code, or alphanumeric",
  })
  @ApiProperty()
  from: string;

  @Column()
  @ApiProperty()
  body: string;

  /** BACKCOMPAT(mms-direction): the default serves the inserts of the release
   * before this column; drop it once no such release writes to mms. */
  @Column({ type: "enum", enum: MmsDirection, default: MmsDirection.Outbound })
  @ApiProperty({ enum: MmsDirection, enumName: "MmsDirection" })
  direction: MmsDirection;

  @Column({
    generatedType: "STORED",
    insert: false,
    update: false,
    asExpression: `CASE WHEN "direction" = 'inbound' THEN "from" ELSE "to" END`,
    comment: "The member's side of the message",
  })
  @ApiProperty()
  memberPhoneNumber: string;

  @Column({
    type: "enum",
    enum: MmsKeyword,
    nullable: true,
    comment: "The STOP or START keyword the inbound webhook acted on",
  })
  keyword: MmsKeyword | null;

  // Named by string: a value import of User fails at load, as the cycle
  // through user.entity reaches action-event-notif.entity's eager
  // `type: Mms` before Mms is defined. Typed as the fields read: a full User
  // closes the type cycle User.optInMms -> Mms, on which tsc rejects
  // TypeORM's update types for Mms depending on the order it checks files.
  @ManyToOne("User", { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "sentById" })
  sentBy?: Relation<Pick<User, "name">> | null;

  @Column({ type: "int", nullable: true, comment: "Staff member who wrote it" })
  sentById: number | null;

  @Column({ type: "text" })
  @ApiProperty({ type: String })
  status: MessageStatus;

  @Column()
  @ApiProperty()
  twilioSid: string;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ nullable: true })
  errorCode: number | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  errorMessage: string | null;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  updatedAt: Date;

  @Index()
  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  cid: string | null;

  @Column({ default: false })
  @ApiProperty({ type: Boolean })
  clickedLink: boolean;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
