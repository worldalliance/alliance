import { OAuthProvider } from "@alliance/common/oauth";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { KoraParticipant } from "./kora-participant.entity";

@Entity("kora_participant_oauth_identity")
@Index(["provider", "subject"], { unique: true })
@Index(["participantId", "provider"], { unique: true })
export class KoraParticipantOAuthIdentity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  participantId: string;

  @ManyToOne(() => KoraParticipant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participantId" })
  participant?: Relation<KoraParticipant>;

  @Column({ type: "enum", enum: OAuthProvider, enumName: "OAuthProvider" })
  provider: OAuthProvider;

  /** The provider's stable id for the person; `sub` in its id token. */
  @Column()
  subject: string;

  /** The provider's latest email, which never changes the participant's contact. */
  @Column({ type: "citext" })
  email: string;

  @CreateDateColumnTz()
  createdAt: Date;
}
