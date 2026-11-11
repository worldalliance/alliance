import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { MmsThreadDto, MmsThreadQueryDto } from "./dto/mms-thread.dto";
import { MmsThreadService, ThreadRefusal } from "./mms-thread.service";

const refusalException: Record<ThreadRefusal, () => Error> = {
  [ThreadRefusal.MemberNotFound]: () =>
    new NotFoundException("Member not found"),
  [ThreadRefusal.BeforeNotInThread]: () =>
    new BadRequestException("That text isn't in this thread."),
};

@Controller("mms-threads")
@UseGuards(AdminGuard)
@ApiUnauthorizedResponse()
export class MmsThreadController {
  constructor(private readonly threadService: MmsThreadService) {}

  @Get(":userId")
  @ApiOkResponse({ type: MmsThreadDto })
  async getThreadAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Query() query: MmsThreadQueryDto,
  ): Promise<MmsThreadDto> {
    const thread = await this.threadService.getThread({
      userId,
      before: query.before,
    });
    if (!thread.ok) throw refusalException[thread.error]();
    return new MmsThreadDto(thread.value);
  }
}
