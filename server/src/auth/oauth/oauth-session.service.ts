import { AnalyticsEvent } from "@alliance/common/analytics";
import { OAuthOutcome, OAuthProvider } from "@alliance/common/oauth";
import { Injectable } from "@nestjs/common";
import { PosthogService } from "src/posthog/posthog.service";
import { User } from "src/user/entities/user.entity";
import { AuthService } from "../auth.service";
import type { OAuthAuthentication } from "./oauth-auth.service";
import type { SessionTokens } from "./oauth.dto";

const OUTCOME_EVENT: Record<OAuthOutcome, AnalyticsEvent> = {
  [OAuthOutcome.SignedUp]: AnalyticsEvent.NewUser,
  [OAuthOutcome.SignedIn]: AnalyticsEvent.Login,
  [OAuthOutcome.Linked]: AnalyticsEvent.Login,
};

@Injectable()
export class OAuthSessionService {
  constructor(
    private authService: AuthService,
    private posthog: PosthogService,
  ) {}

  async startMobileSession(
    params: OAuthAuthentication & {
      provider: OAuthProvider;
      guestToken: string | undefined;
    },
  ): Promise<SessionTokens> {
    this.capture(params);
    await this.authService.mergeGuestFromToken(
      params.guestToken,
      params.user.id,
    );
    return this.issueTokens(params.user);
  }

  async issueTokens(user: User): Promise<SessionTokens> {
    return {
      access_token: await this.authService.generateAccessToken(user),
      refresh_token: await this.authService.generateRefreshToken(user),
    };
  }

  capture(params: {
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
