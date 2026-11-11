import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Mms } from "./mms.entity";

@Entity()
@Index(["copyAttempts", "id"], { where: `"s3Key" IS NULL` })
@Index(["twilioDeleteAttempts", "id"], {
  where: `"s3Key" IS NOT NULL AND "twilioDeletedAt" IS NULL`,
})
export class MmsMedia {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Mms, (mms) => mms.media, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "mmsId" })
  mms?: Relation<Mms>;

  @Index()
  @Column()
  mmsId: number;

  @Column({ comment: "As Twilio reported it; not verified" })
  contentType: string;

  @Column({ comment: "Twilio Media resource, deleted once copied to S3" })
  twilioUrl: string;

  @Column({ type: "timestamptz", nullable: true })
  twilioDeletedAt: Date | null;

  @Column({ type: "int", default: 0, comment: "Deletions Twilio refused" })
  twilioDeleteAttempts: number;

  @Column({ type: "timestamptz", nullable: true })
  lastTwilioDeleteAttemptAt: Date | null;

  @Column({ type: "varchar", nullable: true })
  s3Key: string | null;

  @Column({ type: "int", default: 0, comment: "Failed copies to S3" })
  copyAttempts: number;

  @Column({ type: "timestamptz", nullable: true })
  lastCopyAttemptAt: Date | null;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
