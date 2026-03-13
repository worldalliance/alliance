import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import { User } from 'src/user/entities/user.entity';
import { ForumDigestPreference } from 'src/user/entities/user.entity';

interface StoredNotificationSummary {
  id: number;
  message: string;
  url?: string | null;
  createdAt: string;
}

@Entity()
@Unique(['user', 'digestDate'])
export class ForumDigestLog {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @ApiProperty({ type: () => User })
  user: User;

  @Column({ type: 'date' })
  @ApiProperty({ type: String, format: 'date' })
  digestDate: string;

  @Column({
    type: 'enum',
    enum: ForumDigestPreference,
    enumName: 'user_forumdigestpreference_enum',
  })
  @ApiProperty({
    enum: ForumDigestPreference,
    enumName: 'ForumDigestPreference',
  })
  preferenceUsed: ForumDigestPreference;

  @Column({ type: 'int' })
  @ApiProperty()
  notificationsCount: number;

  @Column({ type: 'int', array: true, default: [] })
  @ApiProperty({ type: Number, isArray: true })
  notificationIds: number[];

  @Column({ type: 'jsonb', nullable: true })
  @ApiPropertyOptional({
    isArray: true,
  })
  notificationsSummary?: StoredNotificationSummary[];

  @CreateDateColumnTz()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
