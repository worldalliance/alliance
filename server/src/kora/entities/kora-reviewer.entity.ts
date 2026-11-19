import {
  KoraAgeBand,
  KoraChildAgeBand,
  KoraChildAiUse,
  KoraEducation,
  KoraEnglish,
  KoraGender,
  KoraHouseholdIncome,
  KoraUsRegion,
} from "@alliance/common/kora-demographics";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { z } from "zod";
import { KoraParticipant } from "./kora-participant.entity";

/**
 * KORA's v6 sign-up questionnaire. Every field is nullable because every
 * question is optional; a null column and a stored `prefer_not_to_say` are
 * different answers, and Annex D exports them differently.
 */
export const koraDemographicsSchema = z.object({
  ageBand: z.enum(KoraAgeBand).nullable(),
  gender: z.enum(KoraGender).nullable(),
  country: z.string().nullable(),
  usRegion: z.enum(KoraUsRegion).nullable(),
  isParent: z.boolean().nullable(),
  childrenAgeBands: z.array(z.enum(KoraChildAgeBand)),
  childAiUse: z.enum(KoraChildAiUse).nullable(),
  worksWithChildrenOrHealth: z.boolean().nullable(),
  education: z.enum(KoraEducation).nullable(),
  householdIncome: z.enum(KoraHouseholdIncome).nullable(),
  english: z.enum(KoraEnglish).nullable(),
});

export type KoraDemographics = z.infer<typeof koraDemographicsSchema>;

/**
 * The opaque reviewer the review tool and KORA see: one per member and one per
 * participant, never linked to each other.
 */
@Entity()
@Check(`num_nonnulls("participantId", "userId") = 1`)
export class KoraReviewer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({ type: "uuid", nullable: true })
  participantId: string | null;

  @ManyToOne(() => KoraParticipant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participantId" })
  participant?: Relation<KoraParticipant>;

  @Index({ unique: true })
  @Column({ type: "int", nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  /** The sign-up questionnaire, null until the reviewer passes its screen; parse with {@link parseKoraReviewer}. */
  @Column({ type: "jsonb", nullable: true })
  demographics: unknown | null;

  /** When the reviewer agreed to take part (spec 6.0 section 6); no session is served before it. */
  @Column({ type: "timestamptz", nullable: true })
  consentAt: Date | null;

  /** When the reviewer finished the sign-up screens, after which they go straight to reviewing. */
  @Column({ type: "timestamptz", nullable: true })
  onboardedAt: Date | null;

  /** When the reviewer was last told more reviews are ready; resent after each newer batch. */
  @Column({ type: "timestamptz", nullable: true })
  moreNotifiedAt: Date | null;

  /** Risks the reviewer asked not to be shown; the queue leaves them out from the next conversation served. */
  @Column({ type: "text", array: true, default: () => "'{}'" })
  optOutCategories: string[];

  /** Opted in to conversations longer than three AI turns (spec 6.0 section 5). */
  @Column({ type: "boolean", default: false })
  extendedOptIn: boolean;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}

export interface ParsedKoraReviewer extends KoraReviewer {
  demographics: KoraDemographics | null;
}

export function parseKoraReviewer(reviewer: KoraReviewer): ParsedKoraReviewer {
  reviewer.demographics =
    reviewer.demographics == null
      ? null
      : koraDemographicsSchema.parse(reviewer.demographics);
  return reviewer as ParsedKoraReviewer;
}
