import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity()
export class SpentToken {
  /** sha256, base64url. The credential itself never reaches the database. */
  @PrimaryColumn()
  hash: string;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;
}
