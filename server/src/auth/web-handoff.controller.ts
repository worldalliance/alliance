import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiResponse } from "@nestjs/swagger";
import type { Request as ExpressRequest, Response } from "express";
import { env, requireEnv } from "../config/env";
import { AuthService } from "./auth.service";
import { WebHandoffDto } from "./dto/web-handoff.dto";
import { AuthGuard } from "./guards/auth.guard";
import { NotImpersonatingGuard } from "./guards/not-impersonating.guard";
import { OAuthSessionService } from "./oauth/oauth-session.service";
import { siteUrlForHost } from "./site-url";
import type { JwtRequest } from "./tokens";
import { sitePath, WebHandoffService } from "./web-handoff.service";

/** Signs the mobile app's member into a webview without putting a token in a URL for longer than a minute. */
@Controller("auth/web-handoff")
export class WebHandoffController {
  constructor(
    private readonly handoffs: WebHandoffService,
    private readonly sessions: OAuthSessionService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @UseGuards(AuthGuard, NotImpersonatingGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WebHandoffDto })
  async create(@Request() req: JwtRequest): Promise<WebHandoffDto> {
    return new WebHandoffDto({
      code: await this.handoffs.create(req.user.sub),
    });
  }

  /** A spent or expired code still lands on `next`, signed out, where the page asks to sign in. */
  @Get("redeem")
  @ApiResponse({
    status: 302,
    description:
      "Sets the web session when the code is good, then goes to next",
  })
  @ApiQuery({ name: "code", type: String })
  @ApiQuery({ name: "next", type: String, required: false })
  async redeem(
    @Query("code") code: string,
    @Query("next") next: string | undefined,
    @Request() req: ExpressRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.handoffs.redeem(String(code ?? ""));
    if (user.ok) {
      const { access_token, refresh_token } = await this.sessions.issueTokens(
        user.value,
      );
      this.authService.setAuthCookies(res, access_token, refresh_token);
    }
    const site = siteUrlForHost({
      host: req.get("host"),
      appUrl: requireEnv("APP_URL"),
      altAppUrl: env("ALT_APP_URL"),
    });
    res.redirect(site + sitePath(next, "/"));
  }
}
