import { KoraReviewStatus } from "@alliance/common/kora";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { KoraConversation } from "./kora-conversation.entity";
import { KoraSession } from "./kora-session.entity";

/** One conversation served in a session: the reservation, and its status as of the latest export. */
@Entity()
@Index(["conversationId", "status"])
export class KoraSessionConversation {
  @PrimaryColumn({ type: "uuid" })
  sessionId: string;

  @ManyToOne(() => KoraSession, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sessionId" })
  session?: Relation<KoraSession>;

  @PrimaryColumn({ type: "varchar" })
  conversationId: string;

  @ManyToOne(() => KoraConversation, { onDelete: "CASCADE" })
  @JoinColumn({ name: "conversationId" })
  conversation?: Relation<KoraConversation>;

  /** The order it was served in, from 0, practice and attention conversations included. */
  @Column({ type: "int" })
  position: number;

  /** 1-based among the session's rated conversations, which is what the export records. */
  @Column({ type: "int", nullable: true })
  ratedPosition: number | null;

  /** The reviewer's first conversation on this risk: the guide opens, and the soft block applies. */
  @Column({ type: "boolean" })
  firstTimeOnRisk: boolean;

  @Column({
    type: "enum",
    enum: KoraReviewStatus,
    enumName: "KoraReviewStatus",
    default: KoraReviewStatus.Pending,
  })
  status: KoraReviewStatus;

  /** The verdict matched the import's reference verdict. Null unless this was the attention conversation. */
  @Column({ type: "boolean", nullable: true })
  attentionPass: boolean | null;

  /** The last save that changed this conversation's rating; the release window runs from here. */
  @Column({ type: "timestamptz", default: () => "now()" })
  lastActivityAt: Date;
}
