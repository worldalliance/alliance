import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  type PaginatedList,
  PaginatedListDto,
  PaginationQueryDto,
} from 'src/utils/pagination.dto';
import { User } from '../../user/entities/user.entity';
import { EventLog, EventType } from '../event-log.entity';

export class EventLogUserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  displayName: string;

  constructor(input: User) {
    this.id = input.id;
    this.displayName = input.anonymous ? 'Someone' : input.name;
  }
}

export class EventLogDto extends PickType(EventLog, [
  'id',
  'event',
  'message',
  'blob',
  'createdAt',
  'userId',
]) {
  @ApiPropertyOptional({ type: () => EventLogUserDto })
  user?: EventLogUserDto;

  constructor(input: EventLog) {
    super();
    this.id = input.id;
    this.event = input.event;
    this.message = input.message;
    this.blob = input.blob;
    this.createdAt = input.createdAt;
    this.userId = input.userId;
    this.user = input.user ? new EventLogUserDto(input.user) : undefined;
  }
}

export type EventLogList = PaginatedList<EventLog>;

export class EventLogListDto extends PaginatedListDto(EventLogDto) {}

export class EventLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EventType, enumName: 'EventType' })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;
}
