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
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Public } from "src/auth/public.decorator";
import {
  WAITLIST_ENTRY_THROTTLE,
  WAITLIST_LINK_THROTTLE,
} from "src/auth/signup-throttle.config";
import { EmailType } from "src/mail/mail.entity";
import { OnlyThrottle } from "src/utils/throttle";
import {
  CreateWaitlistEntryDto,
  WaitlistCountDto,
  WaitlistEntryResultDto,
  WaitlistLinkRequestDto,
  WaitlistMailConfigDto,
  WaitlistReferralCodesDto,
  WaitlistReferralDto,
} from "./dto/waitlist.dto";
import {
  publicMailDailyCap,
  WaitlistMailService,
} from "./waitlist-mail.service";
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
  constructor(
    private readonly waitlistService: WaitlistService,
    private readonly waitlistMailService: WaitlistMailService,
  ) {}

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
    if (created.value !== null) {
      void this.waitlistMailService.sendShareLink({
        email: dto.email,
        emailType: EmailType.WaitlistConfirmation,
      });
    }
    return new WaitlistEntryResultDto(created.value);
  }

  /**
   * Answers alike whether or not the address has an entry, and mails in the
   * background so the response time doesn't tell either.
   */
  @Post("link-requests")
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(WAITLIST_LINK_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async requestLink(@Body() dto: WaitlistLinkRequestDto): Promise<void> {
    if (publicMailDailyCap() === null) {
      throw new ServiceUnavailableException("Emailing links is not available");
    }
    void this.waitlistMailService.sendShareLink({
      email: dto.email,
      emailType: EmailType.WaitlistLink,
    });
  }

  @Get("mail-config")
  @Public()
  @ApiOkResponse({ type: WaitlistMailConfigDto })
  mailConfig(): WaitlistMailConfigDto {
    return new WaitlistMailConfigDto(publicMailDailyCap() !== null);
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
