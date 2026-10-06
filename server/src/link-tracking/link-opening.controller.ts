import { R } from "@alliance/common/result";
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Public } from "src/auth/public.decorator";
import { OnlyThrottle } from "src/utils/throttle";
import { RecordLinkOpeningDto } from "./dto/link-opening.dto";
import { LINK_OPENING_THROTTLE } from "./link-opening-throttle.config";
import {
  LinkOpeningRejection,
  LinkOpeningService,
} from "./link-opening.service";

const REJECTION: Record<LinkOpeningRejection, () => HttpException> = {
  [LinkOpeningRejection.Invalid]: () =>
    new BadRequestException("Invalid link opening"),
  [LinkOpeningRejection.Unknown]: () =>
    new NotFoundException("Unknown tracking ID"),
};

/** Signed out too: a tracking ID only lets its holder report an opening. */
@Controller("link-openings")
export class LinkOpeningController {
  constructor(private readonly linkOpeningService: LinkOpeningService) {}

  @Post()
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(LINK_OPENING_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async record(@Body() dto: RecordLinkOpeningDto): Promise<void> {
    const recorded = await this.linkOpeningService.record({
      dto,
      now: new Date(),
    });
    if (R.isFailure(recorded)) throw REJECTION[recorded.error]();
  }
}
