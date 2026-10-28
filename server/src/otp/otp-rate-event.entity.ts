import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity()
@Index(["bucket", "createdAt"])
export class OtpRateEvent {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: string;

  /** Keyed digest of what is limited, so no contact or IP is stored. */
  @Column()
  bucket: string;

  @Index()
  @Column({ type: "timestamptz" })
  createdAt: Date;
}
