import { R } from "@alliance/common/result";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Public } from "src/auth/public.decorator";
import {
  WAITLIST_ENTRY_THROTTLE,
  WAITLIST_LINK_THROTTLE,
} from "src/auth/signup-throttle.config";
import { EmailType } from "src/mail/mail.entity";
import { OnlyThrottle } from "src/utils/throttle";
import {
  CreateWaitlistEntryDto,
  RememberInviteDto,
  WaitlistBrowserDto,
  WaitlistCountDto,
  WaitlistEntryResultDto,
  WaitlistLinkRequestDto,
  WaitlistMailConfigDto,
  WaitlistReferralCodesDto,
  WaitlistReferralDto,
  WaitlistUnsubscribeDto,
} from "./dto/waitlist.dto";
import { WaitlistBrowserService } from "./waitlist-browser.service";
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
    case WaitlistEntryError.OneContact:
      return new BadRequestException(
        "Send either an email address or a phone number",
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
    private readonly browserService: WaitlistBrowserService,
  ) {}

  @Post("entries")
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(WAITLIST_ENTRY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WaitlistEntryResultDto })
  async create(
    @Body() dto: CreateWaitlistEntryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WaitlistEntryResultDto> {
    const created = await this.waitlistService.create(dto);
    if (R.isFailure(created)) {
      throw entryException(created.error);
    }
    if (created.value === null) {
      return new WaitlistEntryResultDto(null);
    }
    if (dto.email !== undefined) {
      void this.waitlistMailService.sendShareLink({
        email: dto.email,
        emailType: EmailType.WaitlistConfirmation,
      });
    }
    await this.browserService.rememberEntry({
      res,
      entryId: created.value.id,
    });
    return new WaitlistEntryResultDto(created.value.code);
  }

  @Get("browser")
  @Public()
  @ApiOkResponse({ type: WaitlistBrowserDto })
  async browser(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WaitlistBrowserDto> {
    return new WaitlistBrowserDto(await this.browserService.find(req, res));
  }

  @Post("browser/invite")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async rememberInvite(
    @Body() dto: RememberInviteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.browserService.rememberInvite({ res, code: dto.code });
  }

  @Delete("browser")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async forgetBrowser(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.browserService.forget(req, res);
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

  @Post("unsubscribe")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async unsubscribe(@Body() dto: WaitlistUnsubscribeDto): Promise<void> {
    if (R.isFailure(await this.waitlistService.unsubscribe(dto.token))) {
      throw new NotFoundException("This unsubscribe link is not valid");
    }
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
