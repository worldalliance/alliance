import { OAuthError, OAuthIntent, OAuthProvider } from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiParam } from "@nestjs/swagger";
import { AuthService } from "../auth.service";
import { AuthGuard } from "../guards/auth.guard";
import type { JwtRequest } from "../tokens";
import { beginMobileBrowserSession } from "./mobile-browser-session";
import { OAuthAuthService } from "./oauth-auth.service";
import { OAuthClients } from "./oauth-clients";
import {
  MobileOAuthBrowserSessionDto,
  MobileOAuthLinkHandoffDto,
  MobileOAuthLinkIdentityTokenDto,
  OAuthLinkDto,
  type OAuthLink,
} from "./oauth.dto";
import { ProviderParam } from "./provider-param";

/**
 * The mobile app connecting a provider to the member signed in. Each leaves
 * that member's sessions as they are, and none signs anyone in.
 */
@ApiBearerAuth()
@ApiParam({ name: "provider", enum: OAuthProvider, enumName: "OAuthProvider" })
@Controller("auth/:provider/link")
@UseGuards(AuthGuard)
export class OAuthLinkController {
  constructor(
    private clients: OAuthClients,
    private oauth: OAuthAuthService,
    private authService: AuthService,
  ) {}

  @Post("native")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OAuthLinkDto })
  async withIdentityToken(
    @ProviderParam() provider: OAuthProvider,
    @Request() req: JwtRequest,
    @Body() body: MobileOAuthLinkIdentityTokenDto,
  ): Promise<OAuthLinkDto> {
    if (body.userId !== req.user.sub) {
      return new OAuthLinkDto(R.failure(OAuthError.Failed));
    }
    const profile = await this.clients
      .get(provider)
      .verifyIdentityToken(body.identityToken);
    if (!profile.ok) {
      console.error("oauth identity token rejected", profile.error);
      return new OAuthLinkDto(R.failure(OAuthError.Failed));
    }
    return this.linkedProfile(
      await this.oauth.link({ userId: req.user.sub, profile: profile.value }),
    );
  }

  /** Comes back with a handoff that `link/redeem` takes. */
  @Post("browser")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileOAuthBrowserSessionDto })
  startBrowserSession(
    @ProviderParam() provider: OAuthProvider,
    @Request() req: JwtRequest,
  ): Promise<MobileOAuthBrowserSessionDto> {
    return beginMobileBrowserSession({
      oauth: this.oauth,
      client: this.clients.get(provider),
      provider,
      req,
      intent: OAuthIntent.Link,
      userId: req.user.sub,
    });
  }

  @Post("redeem")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OAuthLinkDto })
  async redeemHandoff(
    @ProviderParam() provider: OAuthProvider,
    @Request() req: JwtRequest,
    @Body() body: MobileOAuthLinkHandoffDto,
  ): Promise<OAuthLinkDto> {
    return this.linkedProfile(
      await this.oauth.redeemLinkHandoff({
        token: body.handoff,
        proof: body.proof,
        provider,
        userId: req.user.sub,
      }),
    );
  }

  private async linkedProfile(linked: OAuthLink): Promise<OAuthLinkDto> {
    if (!linked.ok) {
      return new OAuthLinkDto(linked);
    }
    return new OAuthLinkDto(
      R.success(await this.authService.getProfile(linked.value.email)),
    );
  }
}
