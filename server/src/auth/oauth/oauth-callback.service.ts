import { thrownStack } from "@alliance/common/errorMessage";
import {
  OAuthError,
  OAuthIntent,
  OAuthOutcome,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import type { Request as ExpressRequest, Response } from "express";
import { adoptPosthogContext } from "src/utils/request-context";
import { AuthService } from "../auth.service";
import { extractGuestTokenFromCookie } from "../tokens";
import { takeAppleUser } from "./apple-callback";
import {
  OAuthAuthService,
  OAuthOrigin,
  type OAuthState,
} from "./oauth-auth.service";
import { browserStartedFlow } from "./oauth-browser-proof";
import type { OAuthProfile } from "./oauth-client";
import { OAuthClients } from "./oauth-clients";
import { OAuthSessionService } from "./oauth-session.service";
import {
  fallbackLoginUrl,
  mobileReturnUrlWith,
  returnUrlWithError,
  returnUrlWithOutcome,
} from "./oauth-urls";
import { OAuthCallbackDto } from "./oauth.dto";

const CANCEL_ERROR: Record<OAuthProvider, string> = {
  [OAuthProvider.Google]: "access_denied",
  [OAuthProvider.Apple]: "user_cancelled_authorize",
};

type CallbackParams = {
  req: ExpressRequest;
  res: Response;
  query: OAuthCallbackDto;
  state: OAuthState;
};

@Injectable()
export class OAuthCallbackService {
  constructor(
    private clients: OAuthClients,
    private oauth: OAuthAuthService,
    private authService: AuthService,
    private sessions: OAuthSessionService,
  ) {}

  async handle(params: {
    provider: OAuthProvider;
    req: ExpressRequest;
    query: OAuthCallbackDto;
    res: Response;
  }): Promise<void> {
    const { provider, req, query, res } = params;
    const state = query.state
      ? await this.oauth.verifyState(query.state)
      : null;

    if (!state || state.provider !== provider) {
      const expiredReturnTo = query.state
        ? await this.oauth.expiredMobileReturnTo({
            token: query.state,
            provider,
          })
        : null;
      if (expiredReturnTo) {
        res.redirect(
          mobileReturnUrlWith({
            returnTo: expiredReturnTo,
            handoff: R.failure(OAuthError.Expired),
          }),
        );
        return;
      }
      // Without valid state there is no vetted return address, so fall back to
      // the canonical app rather than trusting anything else in the request.
      res.redirect(
        returnUrlWithError({
          returnTo: fallbackLoginUrl(req),
          provider,
          error: OAuthError.Failed,
        }),
      );
      return;
    }
    if (state.posthog) adoptPosthogContext(state.posthog);

    try {
      switch (state.origin) {
        case OAuthOrigin.Web:
          await this.finishWebFlow({ req, res, query, state });
          break;
        case OAuthOrigin.Mobile:
          await this.finishMobileFlow({ req, res, query, state });
          break;
        default:
          throw new Error(
            `unknown oauth origin: ${state.origin satisfies never}`,
          );
      }
    } catch (error) {
      // The member is mid-navigation, where an exception filter's JSON body
      // would strand them. A verified state always carries a way back.
      console.error("oauth callback failed", thrownStack(error));
      if (!res.headersSent) {
        res.redirect(this.failureUrl(state, OAuthError.Failed));
      }
    }
  }

  private async finishWebFlow(params: CallbackParams): Promise<void> {
    const { req, res, query, state } = params;
    const { provider, returnTo } = state;
    const fail = (error: OAuthError) =>
      res.redirect(returnUrlWithError({ returnTo, provider, error }));

    if (!browserStartedFlow({ req, res, state })) {
      return fail(OAuthError.Failed);
    }

    if (query.error || !query.code) {
      return fail(OAuthError.Cancelled);
    }

    const profile = await this.exchangeCode({
      req,
      res,
      state,
      code: query.code,
    });
    if (!profile.ok) {
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
        this.sessions.capture({ user, provider, outcome });

        const { access_token, refresh_token } =
          await this.sessions.issueTokens(user);
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

  // No proof cookie to check. The system browser shares no cookies with the
  // app, so the proof comes back at redeem instead.
  private async finishMobileFlow(params: CallbackParams): Promise<void> {
    const { req, res, query, state } = params;
    const { provider, returnTo } = state;
    const respond = (handoff: Result<string, OAuthError>) =>
      res.redirect(mobileReturnUrlWith({ returnTo, handoff }));

    if (query.error || !query.code) {
      return respond(
        R.failure(
          query.error === CANCEL_ERROR[provider]
            ? OAuthError.Cancelled
            : OAuthError.Failed,
        ),
      );
    }

    const profile = await this.exchangeCode({
      req,
      res,
      state,
      code: query.code,
    });
    if (!profile.ok) {
      return respond(R.failure(OAuthError.Failed));
    }

    switch (state.intent) {
      case OAuthIntent.Link: {
        if (state.userId === undefined) {
          return respond(R.failure(OAuthError.Failed));
        }
        const linkable = await this.oauth.linkable({
          userId: state.userId,
          profile: profile.value,
        });
        if (!linkable.ok) {
          return respond(linkable);
        }
        const { subject, email } = profile.value;
        respond(
          R.success(
            await this.oauth.signLinkHandoff({
              userId: state.userId,
              provider,
              subject,
              email,
              proofHash: state.proofHash,
            }),
          ),
        );
        return;
      }
      case OAuthIntent.Authenticate: {
        const signedIn = await this.oauth.signIn(profile.value);
        if (!signedIn.ok) {
          return respond(signedIn);
        }
        respond(
          R.success(
            await this.oauth.signHandoff({
              userId: signedIn.value.user.id,
              sessionGeneration: signedIn.value.user.sessionGeneration,
              provider,
              outcome: signedIn.value.outcome,
              proofHash: state.proofHash,
            }),
          ),
        );
        return;
      }
      default:
        throw new Error(
          `unknown oauth intent: ${state.intent satisfies never}`,
        );
    }
  }

  private async exchangeCode(params: {
    req: ExpressRequest;
    res: Response;
    state: OAuthState;
    code: string;
  }): Promise<Result<OAuthProfile, Error>> {
    const { req, res, state } = params;
    const profile = await this.clients.get(state.provider).exchangeCode({
      code: params.code,
      redirectUri: state.redirectUri,
      callbackUser: takeAppleUser(req, res),
    });
    if (!profile.ok) {
      console.error("oauth code exchange failed", profile.error);
    }
    return profile;
  }

  private failureUrl(state: OAuthState, error: OAuthError): string {
    switch (state.origin) {
      case OAuthOrigin.Web:
        return returnUrlWithError({
          returnTo: state.returnTo,
          provider: state.provider,
          error,
        });
      case OAuthOrigin.Mobile:
        return mobileReturnUrlWith({
          returnTo: state.returnTo,
          handoff: R.failure(error),
        });
      default:
        throw new Error(
          `unknown oauth origin: ${state.origin satisfies never}`,
        );
    }
  }
}
