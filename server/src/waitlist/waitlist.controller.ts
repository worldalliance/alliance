import { R } from "@alliance/common/result";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Public } from "src/auth/public.decorator";
import { WAITLIST_ENTRY_THROTTLE } from "src/auth/signup-throttle.config";
import { OnlyThrottle } from "src/utils/throttle";
import {
  CreateWaitlistEntryDto,
  WaitlistCountDto,
  WaitlistEntryResultDto,
  WaitlistReferralCodesDto,
  WaitlistReferralDto,
} from "./dto/waitlist.dto";
import { WaitlistEntryError, WaitlistService } from "./waitlist.service";

function entryException(
  error: WaitlistEntryError,
): BadRequestException | NotFoundException {
  switch (error) {
    case WaitlistEntryError.BothCodes:
      return new BadRequestException(
        "Send a link code or a referrer code, not both",
      );
    case WaitlistEntryError.UnknownCode:
      return new NotFoundException("This waitlist link is not active");
    case WaitlistEntryError.ReasonRequired:
      return new BadRequestException(
        "Tell us why you want to join the Alliance",
      );
    default:
      throw new Error(`unknown waitlist error: ${error satisfies never}`);
  }
}

@Controller("waitlist")
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post("entries")
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(WAITLIST_ENTRY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistEntryResultDto })
  async create(
    @Body() dto: CreateWaitlistEntryDto,
  ): Promise<WaitlistEntryResultDto> {
    const created = await this.waitlistService.create(dto);
    if (R.isFailure(created)) {
      throw entryException(created.error);
    }
    return new WaitlistEntryResultDto(created.value);
  }

  @Get("referral")
  @Public()
  @ApiOkResponse({ type: WaitlistReferralDto })
  async findReferral(
    @Query() query: WaitlistReferralCodesDto,
  ): Promise<WaitlistReferralDto> {
    const referral = await this.waitlistService.findReferral(query);
    if (R.isFailure(referral)) {
      throw entryException(referral.error);
    }
    return new WaitlistReferralDto(referral.value);
  }

  @Get("count")
  @Public()
  @ApiOkResponse({ type: WaitlistCountDto })
  async count(): Promise<WaitlistCountDto> {
    return new WaitlistCountDto(await this.waitlistService.countWaiting());
  }
}
