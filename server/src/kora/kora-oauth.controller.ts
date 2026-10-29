import { thrownStack } from "@alliance/common/errorMessage";
import { KORA_PROJECT_PATH } from "@alliance/common/kora";
import { OAuthError, OAuthProvider } from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiParam, ApiResponse } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { KoraAvailableGuard } from "src/auth/guards/kora-available.guard";
import {
  bounceAppleCallback,
  takeAppleUser,
} from "src/auth/oauth/apple-callback";
import { OAuthClients } from "src/auth/oauth/oauth-clients";
import {
  addProof,
  mintProof,
  OAUTH_PROOF_MAX_AGE_MS,
  spendProof,
} from "src/auth/oauth/oauth-proof";
import {
  callbackUri,
  fallbackAppUrl,
  resolveReturnTo,
  returnUrlWithError,
} from "src/auth/oauth/oauth-urls";
import { OAuthCallbackDto } from "src/auth/oauth/oauth.dto";
import { ProviderParam } from "src/auth/oauth/provider-param";
import { OAUTH_THROTTLE } from "src/auth/signup-throttle.config";
import { readCookie } from "src/utils/cookies";
import { adoptPosthogContext } from "src/utils/request-context";
import { OnlyThrottle } from "src/utils/throttle";
import { StartKoraOAuthDto } from "./dto/kora-participant.dto";
import { clearCookie, KoraCookie, setCookie } from "./kora-cookies";
import {
  type KoraOAuthState,
  KoraOAuthStateService,
} from "./kora-oauth-state.service";
import { KoraParticipantService } from "./kora-participant.service";
import { KoraSessionService } from "./kora-session.service";

/**
 * Participant sign-in through Google or Apple. Each provider has this
 * callback registered beside the member one, which never sees these flows.
 */
@ApiParam({ name: "provider", enum: OAuthProvider, enumName: "OAuthProvider" })
@Controller("kora/:provider")
@UseGuards(KoraAvailableGuard)
export class KoraOAuthController {
  constructor(
    private readonly clients: OAuthClients,
    private readonly stateService: KoraOAuthStateService,
    private readonly participantService: KoraParticipantService,
    private readonly sessionService: KoraSessionService,
  ) {}

  /** A top-level navigation, answered with a redirect to the provider. */
  @Get("start")
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(OAUTH_THROTTLE)
  @ApiResponse({
    status: 302,
    description: "Redirects to the provider's consent screen",
  })
  async start(
    @ProviderParam() provider: OAuthProvider,
    @Req() req: Request,
    @Query() query: StartKoraOAuthDto,
    @Res() res: Response,
  ): Promise<void> {
    adoptPosthogContext({
      sessionId: query.posthogSessionId,
      distinctId: query.posthogDistinctId,
    });
    const returnTo = resolveReturnTo(query.returnTo);
    const redirectUri = callbackUri({
      req,
      path: `/kora/${provider}/callback`,
      returnTo,
    });
    const { proof, proofHash } = mintProof();
    const state = await this.stateService.sign({
      provider,
      redirectUri,
      returnTo: returnTo.toString(),
      timeZone: query.timeZone ?? null,
      proofHash,
    });
    setProofCookie(
      res,
      addProof({ proof, presented: readCookie(req, KoraCookie.OAuth) }),
    );
    res.redirect(
      this.clients.get(provider).authorizationUrl({ redirectUri, state }),
    );
  }

  @Post("callback")
  @ApiResponse({ status: 303, description: "Bounces to GET callback" })
  callbackForm(@Body() body: OAuthCallbackDto, @Res() res: Response): void {
    bounceAppleCallback(body, res);
  }

  @Get("callback")
  @ApiResponse({
    status: 302,
    description: "Redirects back to the page that started the flow",
  })
  async callback(
    @ProviderParam() provider: OAuthProvider,
    @Req() req: Request,
    @Query() query: OAuthCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    const state = query.state
      ? await this.stateService.verify({ token: query.state, provider })
      : R.failure({ error: OAuthError.Failed, returnTo: null });
    if (!state.ok) {
      res.redirect(
        returnUrlWithError({
          returnTo:
            state.error.returnTo ?? fallbackAppUrl(req, KORA_PROJECT_PATH),
          provider,
          error: state.error.error,
        }),
      );
      return;
    }
    if (state.value.posthog) adoptPosthogContext(state.value.posthog);

    try {
      await this.finish({ req, res, query, state: state.value });
    } catch (error) {
      // Mid-navigation, where an exception filter's JSON body would strand
      // the participant.
      console.error("kora oauth callback failed", thrownStack(error));
      if (!res.headersSent) {
        res.redirect(
          returnUrlWithError({
            returnTo: state.value.returnTo,
            provider,
            error: OAuthError.Failed,
          }),
        );
      }
    }
  }

  private async finish(params: {
    req: Request;
    res: Response;
    query: OAuthCallbackDto;
    state: KoraOAuthState;
  }): Promise<void> {
    const { req, res, query, state } = params;
    const { provider, returnTo } = state;
    const fail = (error: OAuthError) =>
      res.redirect(returnUrlWithError({ returnTo, provider, error }));

    const remaining = spendProof({
      presented: readCookie(req, KoraCookie.OAuth),
      proofHash: state.proofHash,
    });
    if (remaining === null) {
      return fail(OAuthError.Failed);
    }
    setProofCookie(res, remaining);

    if (query.error || !query.code) {
      return fail(OAuthError.Cancelled);
    }
    const profile = await this.clients.get(provider).exchangeCode({
      code: query.code,
      redirectUri: state.redirectUri,
      callbackUser: takeAppleUser(req, res),
    });
    if (!profile.ok) {
      console.error("kora oauth code exchange failed", profile.error);
      return fail(OAuthError.Failed);
    }
    const verified = await this.participantService.verifyProvider({
      profile: profile.value,
      timeZone: state.timeZone,
    });
    if (!verified.ok) {
      return fail(verified.error);
    }

    await this.participantService.forgetCode(req, res);
    await this.participantService.forgetSignup(req, res);
    if ("participant" in verified.value) {
      await this.sessionService.begin({
        req,
        res,
        participantId: verified.value.participant.id,
        signedUp: verified.value.signedUp,
        method: verified.value.method,
      });
    } else {
      setCookie({
        res,
        name: KoraCookie.Signup,
        token: verified.value.signupToken,
        maxAgeMs: verified.value.signupTtlMs,
      });
    }
    res.redirect(returnTo);
  }
}

function setProofCookie(res: Response, proofs: string): void {
  if (!proofs) {
    clearCookie(res, KoraCookie.OAuth);
    return;
  }
  setCookie({
    res,
    name: KoraCookie.OAuth,
    token: proofs,
    maxAgeMs: OAUTH_PROOF_MAX_AGE_MS,
  });
}
