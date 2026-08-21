import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "../auth/guards/admin.guard";
import {
  EventLogDto,
  EventLogListDto,
  EventLogQueryDto,
} from "./dto/event-log.dto";
import { EventLogService } from "./eventlog.service";

@Controller("eventlog")
export class EventLogController {
  constructor(private readonly eventLogService: EventLogService) {}

  @Get()
  @ApiOkResponse({ type: EventLogListDto })
  @UseGuards(AdminGuard)
  async findAllAdmin(
    @Query() query: EventLogQueryDto,
  ): Promise<EventLogListDto> {
    return new EventLogListDto(await this.eventLogService.findAll(query));
  }

  @Get(":id")
  @ApiOkResponse({ type: EventLogDto })
  @UseGuards(AdminGuard)
  async findOneAdmin(@Param("id") id: string): Promise<EventLogDto> {
    const event = await this.eventLogService.findOne(id);
    if (!event) {
      throw new NotFoundException(`Event log with id ${id} not found`);
    }
    return new EventLogDto(event);
  }
}
