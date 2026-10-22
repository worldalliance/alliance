import { NotificationChannel } from "src/notifs/notif-utils";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { NotificationKind } from "./notification-kind";

export enum PreferenceSource {
  Member = "member",
  Migrated = "migrated",
  NewAccount = "new_account",
}

/** A member's override of one kind on one channel; no row follows the default. */
@Entity()
export class NotificationPreference {
  @PrimaryColumn()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @PrimaryColumn({ type: "enum", enum: NotificationKind })
  kind: NotificationKind;

  @PrimaryColumn({ type: "enum", enum: NotificationChannel })
  channel: NotificationChannel;

  @Column()
  enabled: boolean;

  @Column({ type: "enum", enum: PreferenceSource })
  source: PreferenceSource;
}
