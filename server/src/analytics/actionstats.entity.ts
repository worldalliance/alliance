import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity()
@Unique(['actionId'])
export class ActionStatsRecord {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty({ description: 'ID of the action this record is for' })
  actionId: number;

  @Column()
  @ApiProperty({ description: 'Name of the action (for display purposes)' })
  actionName: string;

  @Column()
  @ApiProperty({
    description: 'Number of users who have completed this action',
  })
  usersCompleted: number;

  @Column()
  @ApiProperty({
    description: 'Number of users who joined/were expected to complete',
  })
  usersJoined: number;

  @Column({ default: 0 })
  @ApiProperty({
    description:
      'Number of users who withdrew from this action (declined or wont_complete)',
  })
  usersWithdrawn: number;

  @Column({ default: 0 })
  @ApiProperty({
    description: 'Number of users who dismissed this optional action',
  })
  usersDismissed: number;

  @Column({ type: 'float' })
  @ApiProperty({
    description: 'Completion rate as a fraction (usersCompleted / usersJoined)',
  })
  completionRate: number;

  @Column({ type: 'timestamptz' })
  @ApiProperty({ description: 'When these stats were last calculated' })
  lastCalculatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional({
    description: 'When the action was completed (if applicable)',
  })
  actionCompletedAt?: Date;

  @Column({ default: true })
  @ApiProperty({
    description:
      'Whether to show this action in the chart (false for publicOnly or actions without member_action event)',
  })
  showInChart: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional({
    description: 'When the member_action phase started',
  })
  memberActionStartDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional({
    description: 'When the member_action phase ended (next status event date)',
  })
  memberActionEndDate?: Date;
}
