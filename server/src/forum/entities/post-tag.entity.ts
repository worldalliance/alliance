import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsEmpty, IsNotEmpty, IsOptional } from "class-validator";
import { DeleteDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Post } from "./post.entity";

@Entity()
@Exclusion(
  "EX_post_tag_postId_name",
  `USING btree ("postId" WITH =, "name" WITH =) WHERE ("deletedAt" IS NULL) DEFERRABLE INITIALLY DEFERRED`,
)
@Index(["postId"])
export class PostTag {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @ManyToOne(() => Post, (post) => post.tags, { onDelete: "CASCADE" })
  @JoinColumn()
  @ApiPropertyOptional({ type: () => Post })
  @IsOptional()
  @Type(() => Post)
  post?: Relation<Post>;

  @Column()
  @ApiProperty()
  @Allow()
  postId: number;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @Column({ default: 0 })
  @ApiProperty()
  @Allow()
  sortOrder: number;

  @DeleteDateColumnTz()
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;
}
