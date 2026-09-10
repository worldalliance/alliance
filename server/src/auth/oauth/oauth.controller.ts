import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  OAuthError,
  oauthErrorMessage,
  OAuthIntent,
  OAuthOutcome,
  OAuthProvider,
  parseOAuthProvider,
} from "@alliance/common/oauth";
import {
  BadRequestException,
  Body,
  Controller,
  createParamDecorator,
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
  type ExecutionContext,
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
import { PosthogService } from "src/posthog/posthog.service";
import { DEFAULT_TIME_ZONE, User } from "src/user/entities/user.entity";
import { OnlyThrottle } from "src/utils/throttle";
import { AuthService } from "../auth.service";
import { AuthMeResponseDto } from "../dto/authtokens.dto";
import { AuthGuard } from "../guards/auth.guard";
import { Public } from "../public.decorator";
import {
  APPLE_USER_COOKIE,
  extractAppleUserFromCookie,
  extractGuestTokenFromCookie,
  extractOAuthStateFromCookie,
  OAUTH_STATE_COOKIE,
  type JwtRequest,
} from "../tokens";
import { AppleOAuthClient } from "./apple-oauth.client";
import { GoogleOAuthClient } from "./google-oauth.client";
import {
  addProof,
  mintProof,
  OAuthAuthService,
  spendProof,
  type OAuthState,
} from "./oauth-auth.service";
import type { OAuthClient } from "./oauth-client";
import {
  fallbackLoginUrl,
  oauthRedirectUri,
  resolveReturnTo,
  returnUrlWithError,
  returnUrlWithOutcome,
} from "./oauth-urls";
import { OAuthCallbackDto, OAuthStartDto } from "./oauth.dto";

/** Outlives the state token it guards, so a slow consent screen still lands. */
const STATE_COOKIE_MAX_AGE_MS = 1000 * 60 * 15;

/** Only has to survive the bounce below, which is a single redirect. */
const APPLE_USER_COOKIE_MAX_AGE_MS = 1000 * 60 * 5;

const OUTCOME_EVENT: Record<OAuthOutcome, AnalyticsEvent> = {
  [OAuthOutcome.SignedUp]: AnalyticsEvent.NewUser,
  [OAuthOutcome.SignedIn]: AnalyticsEvent.Login,
  [OAuthOutcome.Linked]: AnalyticsEvent.Login,
};

/**
 * Not a `@Param` with a pipe: Bun emits the enum object as the parameter's
 * design type, and the global ValidationPipe then tries to validate the string
 * as an instance of it.
 */
const ProviderParam = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): OAuthProvider => {
    const provider = parseOAuthProvider(
      ctx.switchToHttp().getRequest<ExpressRequest>().params.provider,
    );
    if (!provider) {
      throw new BadRequestException("unknown sign-in provider");
    }
    return provider;
  },
);

@ApiBearerAuth()
@ApiCookieAuth()
@ApiParam({ name: "provider", enum: OAuthProvider, enumName: "OAuthProvider" })
@Controller("auth/:provider")
export class OAuthController {
  private readonly clients: Record<OAuthProvider, OAuthClient>;

  constructor(
    google: GoogleOAuthClient,
    apple: AppleOAuthClient,
    private oauth: OAuthAuthService,
    private authService: AuthService,
    private posthog: PosthogService,
  ) {
    this.clients = {
      [OAuthProvider.Google]: google,
      [OAuthProvider.Apple]: apple,
    };
  }

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

    this.setProofCookie(
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
        const authenticated =
          await this.authService.getAuthenticatedUserId(req);
        if (authenticated === null) {
          throw new UnauthorizedException();
        }
        userId = authenticated;
        break;
      }
      case OAuthIntent.Authenticate:
        break;
      default:
        throw new Error(
          `unknown oauth intent: ${input.intent satisfies never}`,
        );
    }

    const returnTo = resolveReturnTo(input.returnTo);
    const redirectUri = oauthRedirectUri({ req, provider, returnTo });
    const state = await this.oauth.signState({
      provider,
      intent: input.intent,
      redirectUri,
      returnTo: returnTo.toString(),
      timeZone: input.timeZone ?? DEFAULT_TIME_ZONE,
      proofHash: params.proofHash,
      referralCode: input.referralCode,
      userId,
    });

    return this.clients[provider].authorizationUrl({ redirectUri, state });
  }

  /**
   * Apple answers with a cross-site form post, on which the browser withholds
   * the lax state cookie. Bouncing to a GET on the same URL makes it a
   * top-level navigation, which does carry the cookie.
   */
  @Public()
  @Post("callback")
  @ApiResponse({ status: 303, description: "Bounces to GET callback" })
  callbackForm(@Body() body: OAuthCallbackDto, @Res() res: Response): void {
    // The name rides a cookie rather than the query, which nginx's access log,
    // the request log and the member's history would each write down.
    const { user, ...bounced } = body;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(bounced)) {
      if (typeof value === "string") {
        query.set(key, value);
      }
    }
    if (user) {
      res.cookie(APPLE_USER_COOKIE, user, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: APPLE_USER_COOKIE_MAX_AGE_MS,
      });
    }
    res.redirect(HttpStatus.SEE_OTHER, `?${query}`);
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
    const state = query.state
      ? await this.oauth.verifyState(query.state)
      : null;

    // Without valid state there is no vetted return address, so fall back to
    // the canonical app rather than trusting anything else in the request.
    if (!state || state.provider !== provider) {
      res.redirect(
        returnUrlWithError({
          returnTo: fallbackLoginUrl(req),
          provider,
          error: OAuthError.Failed,
        }),
      );
      return;
    }

    try {
      await this.finishFlow({ req, res, query, state });
    } catch (error) {
      // The member is mid-navigation, where an exception filter's JSON body
      // would strand them. A verified state always carries a way back.
      console.error("oauth callback failed", error);
      if (!res.headersSent) {
        res.redirect(
          returnUrlWithError({
            returnTo: state.returnTo,
            provider,
            error: OAuthError.Failed,
          }),
        );
      }
    }
  }

  private async finishFlow(params: {
    req: ExpressRequest;
    res: Response;
    query: OAuthCallbackDto;
    state: OAuthState;
  }): Promise<void> {
    const { req, res, query, state } = params;
    const { provider, returnTo } = state;
    const fail = (error: OAuthError) =>
      res.redirect(returnUrlWithError({ returnTo, provider, error }));

    if (!this.browserStartedFlow(req, res, state)) {
      return fail(OAuthError.Failed);
    }

    if (query.error || !query.code) {
      return fail(OAuthError.Cancelled);
    }

    const profile = await this.clients[provider].exchangeCode({
      code: query.code,
      redirectUri: state.redirectUri,
      callbackUser: this.takeAppleUser(req, res),
    });
    if (!profile.ok) {
      console.error("oauth code exchange failed", profile.error);
      return fail(OAuthError.Failed);
    }

    switch (state.intent) {
      case OAuthIntent.Link: {
        if (state.userId === undefined) {
          return fail(OAuthError.Failed);
        }
        const linked = await this.oauth.link({
          userId: state.userId,
          profile: profile.value,
        });
        if (!linked.ok) {
          return fail(linked.error);
        }
        res.redirect(
          returnUrlWithOutcome({
            returnTo,
            provider,
            outcome: OAuthOutcome.Linked,
          }),
        );
        return;
      }
      case OAuthIntent.Authenticate: {
        const result = await this.oauth.authenticate({
          profile: profile.value,
          referralCode: state.referralCode,
          timeZone: state.timeZone,
        });
        if (!result.ok) {
          return fail(result.error);
        }

        const { user, outcome } = result.value;
        this.capture({ user, provider, outcome });

        const { access_token, refresh_token } = await this.issueTokens(user);
        this.authService.setAuthCookies(res, access_token, refresh_token);
        // The provider sends the member back to the origin they started on,
        // so the guest cookie rides along and never travels through the state.
        const guestToken = extractGuestTokenFromCookie(req);
        if (guestToken) {
          await this.authService.mergeGuestFromToken(guestToken, user.id);
          this.authService.clearGuestCookie(res);
        }
        res.redirect(returnUrlWithOutcome({ returnTo, provider, outcome }));
        return;
      }
      default:
        throw new Error(
          `unknown oauth intent: ${state.intent satisfies never}`,
        );
    }
  }

  @Delete("link")
  @UseGuards(AuthGuard)
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
      user: await this.authService.getProfile(unlinked.value.email),
    });
  }

  private browserStartedFlow(
    req: ExpressRequest,
    res: Response,
    state: OAuthState,
  ): boolean {
    const remaining = spendProof({
      presented: extractOAuthStateFromCookie(req),
      proofHash: state.proofHash,
    });
    // Left alone when nothing matched, so a stray callback cannot retire the
    // flows this browser still has open.
    if (remaining === null) {
      return false;
    }
    this.setProofCookie(res, remaining);
    return true;
  }

  /** Read once: the bounce is the only hop the name has to survive. */
  private takeAppleUser(
    req: ExpressRequest,
    res: Response,
  ): string | undefined {
    const user = extractAppleUserFromCookie(req);
    if (user) {
      res.clearCookie(APPLE_USER_COOKIE, { path: "/" });
    }
    return user;
  }

  private setProofCookie(res: Response, proofs: string): void {
    if (!proofs) {
      res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
      return;
    }
    res.cookie(OAUTH_STATE_COOKIE, proofs, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // Lax, not strict: the callback arrives as a navigation from the
      // provider, and a strict cookie is not sent on one.
      sameSite: "lax",
      path: "/",
      maxAge: STATE_COOKIE_MAX_AGE_MS,
    });
  }

  private async issueTokens(
    user: User,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return {
      access_token: await this.authService.generateAccessToken(user),
      refresh_token: await this.authService.generateRefreshToken(user),
    };
  }

  private capture(params: {
    user: User;
    provider: OAuthProvider;
    outcome: OAuthOutcome;
  }): void {
    const { user } = params;
    this.posthog.identify({
      distinctId: String(user.id),
      properties: { email: user.email, name: user.name },
    });
    this.posthog.capture({
      event: OUTCOME_EVENT[params.outcome],
      distinctId: String(user.id),
      properties: { method: params.provider, isAdmin: user.admin },
    });
  }
}
