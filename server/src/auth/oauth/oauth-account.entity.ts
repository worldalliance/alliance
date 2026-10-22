import { OAuthProvider } from "@alliance/common/oauth";
import { ApiProperty } from "@nestjs/swagger";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("oauth_account")
@Index(["provider", "subject"], { unique: true, where: '"deletedAt" IS NULL' })
@Index(["userId", "provider"], { unique: true, where: '"deletedAt" IS NULL' })
@Index(["userId"])
export class OAuthAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.oauthAccounts, {
    onDelete: "CASCADE",
    nullable: false,
  })
  user?: Relation<User>;

  @Column()
  userId: number;

  @Column({ type: "enum", enum: OAuthProvider, enumName: "OAuthProvider" })
  @ApiProperty({ enum: OAuthProvider, enumName: "OAuthProvider" })
  provider: OAuthProvider;

  /** The provider's stable id for the person; `sub` in its id token. */
  @Column()
  subject: string;

  @Column()
  @ApiProperty()
  email: string;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
