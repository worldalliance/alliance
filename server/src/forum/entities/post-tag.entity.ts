import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsNotEmpty, IsOptional } from "class-validator";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Post } from "./post.entity";

@Entity()
@Unique(["postId", "name"], { deferrable: "INITIALLY DEFERRED" })
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
}
