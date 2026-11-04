import {
  OAuthError,
  oauthErrorMessage,
  OAuthIntent,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiParam,
  ApiResponse,
} from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request as ExpressRequest, Response } from "express";
import { OAUTH_THROTTLE } from "src/auth/signup-throttle.config";
import { adoptPosthogContext } from "src/utils/request-context";
import { OnlyThrottle } from "src/utils/throttle";
import { AuthService } from "../auth.service";
import { AuthMeResponseDto } from "../dto/authtokens.dto";
import { AuthGuard } from "../guards/auth.guard";
import { NotImpersonatingGuard } from "../guards/not-impersonating.guard";
import { Public } from "../public.decorator";
import {
  extractOAuthStateFromCookie,
  refuseImpersonation,
  type JwtRequest,
} from "../tokens";
import { bounceAppleCallback } from "./apple-callback";
import { beginMobileBrowserSession } from "./mobile-browser-session";
import { OAuthAuthService, OAuthOrigin } from "./oauth-auth.service";
import { setProofCookie } from "./oauth-browser-proof";
import { OAuthCallbackService } from "./oauth-callback.service";
import { OAuthClients } from "./oauth-clients";
import { addProof, mintProof } from "./oauth-proof";
import { OAuthSessionService } from "./oauth-session.service";
import { oauthRedirectUri, resolveReturnTo } from "./oauth-urls";
import {
  MobileIdentityTokenDto,
  MobileOAuthBrowserSessionDto,
  MobileOAuthHandoffDto,
  MobileOAuthSignInDto,
  OAuthCallbackDto,
  OAuthStartDto,
} from "./oauth.dto";
import { ProviderParam } from "./provider-param";

@ApiBearerAuth()
@ApiCookieAuth()
@ApiParam({ name: "provider", enum: OAuthProvider, enumName: "OAuthProvider" })
@Controller("auth/:provider")
export class OAuthController {
  constructor(
    private clients: OAuthClients,
    private oauth: OAuthAuthService,
    private authService: AuthService,
    private sessions: OAuthSessionService,
    private callbacks: OAuthCallbackService,
  ) {}

  /**
   * A top-level navigation, because the server answers with a redirect to
   * the provider and that will not render inside an XHR. The secret binding
   * the flow to this browser goes out as a cookie, the only channel a
   * navigation has.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(OAUTH_THROTTLE)
  @Get("start")
  @ApiResponse({
    status: 302,
    description: "Redirects to the provider's consent screen",
  })
  async redirectToProvider(
    @ProviderParam() provider: OAuthProvider,
    @Request() req: ExpressRequest,
    @Query() query: OAuthStartDto,
    @Res() res: Response,
  ): Promise<void> {
    const { proof, proofHash } = mintProof();
    const consentUrl = await this.beginFlow({
      provider,
      req,
      input: query,
      proofHash,
    });

    setProofCookie(
      res,
      addProof({ proof, presented: extractOAuthStateFromCookie(req) }),
    );
    res.redirect(consentUrl);
  }

  private async beginFlow(params: {
    provider: OAuthProvider;
    req: ExpressRequest;
    input: OAuthStartDto;
    proofHash: string;
  }): Promise<string> {
    const { provider, req, input } = params;

    let userId: number | undefined;
    switch (input.intent) {
      case OAuthIntent.Link: {
        const session = await this.authService.getAuthenticatedSession(req);
        if (session === null) {
          throw new UnauthorizedException();
        }
        refuseImpersonation(session);
        userId = session.sub;
        break;
      }
      case OAuthIntent.Authenticate:
        break;
      default:
        throw new Error(
          `unknown oauth intent: ${input.intent satisfies never}`,
        );
    }

    adoptPosthogContext({
      sessionId: input.posthogSessionId,
      distinctId: input.posthogDistinctId,
    });
    const returnTo = resolveReturnTo(input.returnTo);
    const redirectUri = oauthRedirectUri({ req, provider, returnTo });
    const state = await this.oauth.signState({
      provider,
      intent: input.intent,
      origin: OAuthOrigin.Web,
      redirectUri,
      returnTo: returnTo.toString(),
      timeZone: input.timeZone ?? null,
      proofHash: params.proofHash,
      referralCode: input.referralCode,
      userId,
    });

    return this.clients.get(provider).authorizationUrl({ redirectUri, state });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(OAUTH_THROTTLE)
  @Post("native")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileOAuthSignInDto })
  async signInWithIdentityToken(
    @ProviderParam() provider: OAuthProvider,
    @Body() body: MobileIdentityTokenDto,
  ): Promise<MobileOAuthSignInDto> {
    const profile = await this.clients
      .get(provider)
      .verifyIdentityToken(body.identityToken);
    if (!profile.ok) {
      console.error("oauth identity token rejected", profile.error);
      return new MobileOAuthSignInDto(R.failure(OAuthError.Failed));
    }
    const signedIn = await this.oauth.signIn(profile.value);
    if (!signedIn.ok) {
      return new MobileOAuthSignInDto(signedIn);
    }
    return new MobileOAuthSignInDto(
      R.success(
        await this.sessions.startMobileSession({
          ...signedIn.value,
          provider,
          guestToken: body.guestToken,
        }),
      ),
    );
  }

  /**
   * For a platform with no native sheet for this provider. The app opens `url`
   * in a system browser session, which comes back to it at `returnTo` with a
   * handoff that only `proof` redeems.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(OAUTH_THROTTLE)
  @Post("native/browser")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileOAuthBrowserSessionDto })
  startMobileBrowserSession(
    @ProviderParam() provider: OAuthProvider,
    @Request() req: ExpressRequest,
  ): Promise<MobileOAuthBrowserSessionDto> {
    return beginMobileBrowserSession({
      oauth: this.oauth,
      client: this.clients.get(provider),
      provider,
      req,
      intent: OAuthIntent.Authenticate,
    });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(OAUTH_THROTTLE)
  @Post("native/redeem")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileOAuthSignInDto })
  async redeemMobileHandoff(
    @ProviderParam() provider: OAuthProvider,
    @Body() body: MobileOAuthHandoffDto,
  ): Promise<MobileOAuthSignInDto> {
    const redeemed = await this.oauth.redeemHandoff({
      token: body.handoff,
      proof: body.proof,
      provider,
    });
    if (!redeemed.ok) {
      return new MobileOAuthSignInDto(redeemed);
    }
    return new MobileOAuthSignInDto(
      R.success(
        await this.sessions.startMobileSession({
          ...redeemed.value,
          provider,
          guestToken: body.guestToken,
        }),
      ),
    );
  }

  @Public()
  @Post("callback")
  @ApiResponse({ status: 303, description: "Bounces to GET callback" })
  callbackForm(@Body() body: OAuthCallbackDto, @Res() res: Response): void {
    bounceAppleCallback(body, res);
  }

  @Public()
  @Get("callback")
  @ApiResponse({
    status: 302,
    description: "Redirects back to whichever app started the flow",
  })
  async callback(
    @ProviderParam() provider: OAuthProvider,
    @Request() req: ExpressRequest,
    @Query() query: OAuthCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.callbacks.handle({ provider, req, query, res });
  }

  @Delete("link")
  @UseGuards(AuthGuard, NotImpersonatingGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthMeResponseDto })
  async unlink(
    @ProviderParam() provider: OAuthProvider,
    @Request() req: JwtRequest,
  ): Promise<AuthMeResponseDto> {
    const unlinked = await this.oauth.unlink({
      userId: req.user.sub,
      provider,
    });
    if (!unlinked.ok) {
      throw new BadRequestException(
        oauthErrorMessage(provider, unlinked.error),
      );
    }
    return new AuthMeResponseDto({
      user: await this.authService.getProfile(unlinked.value.id),
    });
  }
}
