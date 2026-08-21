import { ApiProperty } from "@nestjs/swagger";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { Notification } from "src/notifs/entities/notification.entity";
import { UnreadContent } from "src/notifs/entities/unread-content.entity";
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
@Index(["idempotencyKey"], { unique: true })
// Serves the every-minute receipt cron: both its expiry UPDATE and its
// pending-pushes SELECT filter on this predicate, keeping the index tiny.
@Index(["createdAt"], {
  where: `"receiptStatus" = 'pending' AND "receiptId" IS NOT NULL`,
})
export class Push {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

  @Column()
  @ApiProperty()
  expoPushToken: string;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @Column()
  @ApiProperty()
  body: string;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  screen: string | null;

  @UpdateDateColumnTz()
  @ApiProperty()
  updatedAt: Date;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  receiptId: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  ticketStatus: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  receiptStatus: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  errorCode: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  errorMessage: string | null;

  @Column({ type: "timestamp", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  lastCheckedStatusAt: Date | null;

  @Column({ type: "varchar" })
  @ApiProperty()
  idempotencyKey: string;

  @ManyToOne(() => Notification, (notification) => notification.pushes, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "notificationId" })
  notification?: Relation<Notification>;

  @ManyToOne(() => UnreadContent, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "unreadContentId" })
  unreadContent?: Relation<UnreadContent>;

  @ManyToOne(
    () => ActionEventNotif,
    (actionEventNotif) => actionEventNotif.pushes,
    {
      nullable: true,
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({ name: "actionEventNotifId" })
  actionEventNotif?: Relation<ActionEventNotif>;

  @Column({ type: "timestamp", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  openedAt: Date | null;
}
