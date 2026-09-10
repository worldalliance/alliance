import { OAuthProvider } from "@alliance/common/oauth";
import { ApiProperty } from "@nestjs/swagger";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity("oauth_account")
@Unique(["provider", "subject"])
@Unique(["userId", "provider"])
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
}
