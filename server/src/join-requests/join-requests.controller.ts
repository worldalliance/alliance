import { R } from "@alliance/common/result";
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Public } from "src/auth/public.decorator";
import { JOIN_REQUEST_THROTTLE } from "src/auth/signup-throttle.config";
import { OnlyThrottle } from "src/utils/throttle";
import {
  CreateJoinRequestDto,
  JoinRequestResultDto,
} from "./dto/join-request.dto";
import { JoinRequestsService } from "./join-requests.service";

@Controller("join-requests")
export class JoinRequestsController {
  constructor(private readonly joinRequestsService: JoinRequestsService) {}

  @Post()
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(JOIN_REQUEST_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: JoinRequestResultDto })
  async create(
    @Body() dto: CreateJoinRequestDto,
  ): Promise<JoinRequestResultDto> {
    const recorded = await this.joinRequestsService.create(dto);
    if (R.isFailure(recorded)) {
      throw new InternalServerErrorException("Failed to record join request");
    }
    return new JoinRequestResultDto(true);
  }
}
