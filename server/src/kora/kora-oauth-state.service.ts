import { OAuthError, OAuthProvider } from "@alliance/common/oauth";
import { posthogContextSchema } from "@alliance/common/posthog";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OAUTH_STATE_LIFETIME } from "src/auth/oauth/oauth-proof";
import { JWTTokenType } from "src/auth/tokens";
import { requestContext } from "src/utils/request-context";
import { z } from "zod";

/**
 * Its own token type, so neither callback accepts the other's state: a member
 * flow never signs in a participant, and the reverse.
 */
const koraOAuthStateSchema = z.object({
  tokenType: z.literal(JWTTokenType.koraOAuthState),
  provider: z.enum(OAuthProvider),
  redirectUri: z.string(),
  returnTo: z.string(),
  timeZone: z.string().nullable(),
  /** Hash of the proof in the starting browser's `kora_oauth` cookie. */
  proofHash: z.string(),
  posthog: posthogContextSchema.optional(),
  exp: z.number(),
});

export type KoraOAuthState = z.infer<typeof koraOAuthStateSchema>;

export type KoraOAuthStateRefusal = {
  error: OAuthError.Failed | OAuthError.Expired;
  /** Vetted at start, so only a state this server signed carries one. */
  returnTo: string | null;
};

@Injectable()
export class KoraOAuthStateService {
  constructor(private readonly jwtService: JwtService) {}

  sign(
    state: Omit<KoraOAuthState, "tokenType" | "posthog" | "exp">,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        ...state,
        posthog: requestContext.getStore()?.posthog,
        tokenType: JWTTokenType.koraOAuthState,
      },
      { expiresIn: OAUTH_STATE_LIFETIME },
    );
  }

  async verify(params: {
    token: string;
    provider: OAuthProvider;
  }): Promise<Result<KoraOAuthState, KoraOAuthStateRefusal>> {
    const payload = await R.fromPromise(
      this.jwtService.verifyAsync<object>(params.token, {
        secret: process.env.JWT_SECRET,
        ignoreExpiration: true,
      }),
    );
    const state = koraOAuthStateSchema.safeParse(
      payload.ok ? payload.value : null,
    );
    if (!state.success || state.data.provider !== params.provider) {
      return R.failure({ error: OAuthError.Failed, returnTo: null });
    }
    if (state.data.exp * 1000 <= Date.now()) {
      return R.failure({
        error: OAuthError.Expired,
        returnTo: state.data.returnTo,
      });
    }
    return R.success(state.data);
  }
}
