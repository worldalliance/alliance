import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AuthGuard } from "src/auth/guards/auth.guard";
import { UnfetchableUrl } from "src/utils/safe-http";
import { OnlyThrottle, UserThrottlerGuard } from "src/utils/throttle";
import { LINK_PREVIEW_THROTTLE } from "./link-preview-throttle.config";
import { LinkPreviewDto, LinkPreviewQueryDto } from "./link-preview.dto";
import {
  LinkPreviewError,
  LinkPreviewService,
  PreviewUnavailable,
} from "./link-preview.service";

// "your URL is broken", "your URL is fine but we refuse it on principle",
// and "we're too busy right now" deserve different responses: the first two
// are per-cause 400s so a caller can tell which rule to relax, the last a
// 503 so clients treat it as retryable instead of caching "no preview".
function exceptionFor(error: LinkPreviewError): HttpException {
  switch (error) {
    case UnfetchableUrl.Malformed:
      return new BadRequestException("url must be a valid absolute URL");
    case UnfetchableUrl.UnsupportedScheme:
      return new BadRequestException("url must use http or https");
    case UnfetchableUrl.ExplicitPort:
      return new BadRequestException("url must not specify a non-default port");
    case PreviewUnavailable.Overloaded:
      return new ServiceUnavailableException(
        "link preview is temporarily overloaded, retry later",
      );
    default:
      throw new Error(`unknown error: ${error satisfies never}`);
  }
}

@Controller("link-preview")
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  @UseGuards(AuthGuard, UserThrottlerGuard)
  @OnlyThrottle(LINK_PREVIEW_THROTTLE)
  @ApiOkResponse({ type: LinkPreviewDto })
  async getPreview(
    @Query() query: LinkPreviewQueryDto,
  ): Promise<LinkPreviewDto> {
    const preview = await this.linkPreviewService.getPreview(query.url);
    if (!preview.ok) {
      throw exceptionFor(preview.error);
    }
    return new LinkPreviewDto(preview.value);
  }
}
