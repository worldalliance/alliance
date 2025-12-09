import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
@Unique(['dayId'])
export class DailyStatsRecord {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  dayId: string;

  @Column()
  @ApiProperty()
  date: Date;

  @Column()
  @ApiProperty()
  signedMembers: number;

  @Column()
  @ApiProperty()
  suspendedMembers: number;

  @Column()
  @ApiProperty()
  actionsCompleted: number;

  @Column()
  @ApiProperty()
  invitesCreated: number;

  @Column()
  @ApiProperty()
  invitesAccepted: number;
}
