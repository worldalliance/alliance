import {
  OAuthError,
  OAuthOutcome,
  OAuthProvider,
  type OAuthIntent,
} from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { BadRequestException, Injectable } from "@nestjs/common";
import { JwtService, TokenExpiredError } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { Not, type Repository } from "typeorm";
import { z } from "zod";
import { AuthService } from "../auth.service";
import { SpentTokenService } from "../spent-token.service";
import { JWTTokenType } from "../tokens";
import { OAuthAccount } from "./oauth-account.entity";
import type { OAuthProfile } from "./oauth-client";

export enum OAuthOrigin {
  Web = "web",
  Mobile = "mobile",
}

export type OAuthState = {
  tokenType: JWTTokenType.oauthState;
  provider: OAuthProvider;
  intent: OAuthIntent;
  origin: OAuthOrigin;
  redirectUri: string;
  returnTo: string;
  timeZone: string;
  /**
   * Hash of the secret held by whoever started the flow, a cookie in the
   * browser and a value handed back over the API on native. Without it,
   * finishing the flow in someone else's browser signs them into your account.
   */
  proofHash: string;
  referralCode?: string;
  userId?: number;
};

/**
 * What the callback of a mobile-started browser session sends back to the app.
 * It rides a deep link another app could catch, so it signs nobody in until
 * the proof the app kept comes with it.
 *
 * Parsed rather than cast: every token this server signs shares one secret, so
 * the shape is what separates a handoff from a state token the app also holds.
 */
const handoffSchema = z.object({
  tokenType: z.literal(JWTTokenType.oauthHandoff),
  userId: z.number(),
  provider: z.enum(OAuthProvider),
  outcome: z.enum(OAuthOutcome),
  proofHash: z.string(),
});

export type OAuthHandoff = z.infer<typeof handoffSchema>;

export type OAuthProof = {
  proof: string;
  proofHash: string;
};

export type OAuthAuthentication = {
  user: User;
  outcome: OAuthOutcome;
};

const STATE_LIFETIME = "10m";
const HANDOFF_LIFETIME_MS = milliseconds({ minutes: 5 });

export function mintProof(): OAuthProof {
  const proof = randomBytes(32).toString("base64url");
  return { proof, proofHash: hashProof(proof) };
}

function hashProof(proof: string): string {
  return createHash("sha256").update(proof).digest("base64url");
}

export function proofMatches(proof: string, proofHash: string): boolean {
  const presented = Buffer.from(hashProof(proof));
  const expected = Buffer.from(proofHash);
  return (
    presented.length === expected.length && timingSafeEqual(presented, expected)
  );
}

/**
 * One cookie holds the flows this browser has open, newest first, because a
 * member with the login page in one tab and signup in another must be able to
 * finish either. Base64url never contains the separator.
 */
const PROOF_SEPARATOR = ",";
const CONCURRENT_FLOWS = 3;

export function addProof(params: {
  proof: string;
  presented: string | undefined;
}): string {
  const open = params.presented ? params.presented.split(PROOF_SEPARATOR) : [];
  return [params.proof, ...open]
    .slice(0, CONCURRENT_FLOWS)
    .join(PROOF_SEPARATOR);
}

/** The proofs left once this flow's is spent, or null if it holds none. */
export function spendProof(params: {
  presented: string | undefined;
  proofHash: string;
}): string | null {
  const open = params.presented ? params.presented.split(PROOF_SEPARATOR) : [];
  const spent = open.findIndex((proof) =>
    proofMatches(proof, params.proofHash),
  );
  if (spent === -1) {
    return null;
  }
  return open.filter((_, index) => index !== spent).join(PROOF_SEPARATOR);
}

@Injectable()
export class OAuthAuthService {
  constructor(
    private authService: AuthService,
    private usersService: UserService,
    private jwtService: JwtService,
    @InjectRepository(OAuthAccount)
    private accountRepository: Repository<OAuthAccount>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private spentTokens: SpentTokenService,
  ) {}

  signState(state: Omit<OAuthState, "tokenType">): Promise<string> {
    return this.jwtService.signAsync(
      { ...state, tokenType: JWTTokenType.oauthState },
      { expiresIn: STATE_LIFETIME },
    );
  }

  verifyState(token: string): Promise<OAuthState | null> {
    return this.readState({ token, ignoreExpiration: false });
  }

  /**
   * Where to tell the app its flow expired. A web flow gets null and lands on
   * the login page like any other bad state.
   */
  async expiredMobileReturnTo(params: {
    token: string;
    provider: OAuthProvider;
  }): Promise<string | null> {
    const state = await this.readState({
      token: params.token,
      ignoreExpiration: true,
    });
    if (!state || state.provider !== params.provider) {
      return null;
    }
    switch (state.origin) {
      case OAuthOrigin.Web:
        return null;
      case OAuthOrigin.Mobile:
        return state.returnTo;
      default:
        throw new Error(
          `unknown oauth origin: ${state.origin satisfies never}`,
        );
    }
  }

  private async readState(params: {
    token: string;
    ignoreExpiration: boolean;
  }): Promise<OAuthState | null> {
    const payload = await R.fromPromise(
      this.jwtService.verifyAsync<OAuthState>(params.token, {
        secret: process.env.JWT_SECRET,
        ignoreExpiration: params.ignoreExpiration,
      }),
    );
    if (!payload.ok || payload.value.tokenType !== JWTTokenType.oauthState) {
      return null;
    }
    // A state minted before origin existed is a web flow, and the deploy that
    // adds it can still have some in flight.
    return {
      ...payload.value,
      origin: payload.value.origin ?? OAuthOrigin.Web,
    };
  }

  signHandoff(handoff: Omit<OAuthHandoff, "tokenType">): Promise<string> {
    return this.jwtService.signAsync(
      { ...handoff, tokenType: JWTTokenType.oauthHandoff },
      { expiresIn: HANDOFF_LIFETIME_MS / 1000 },
    );
  }

  async redeemHandoff(params: {
    token: string;
    proof: string;
    provider: OAuthProvider;
  }): Promise<Result<OAuthAuthentication, OAuthError>> {
    const payload = await R.fromPromise(
      this.jwtService.verifyAsync(params.token, {
        secret: process.env.JWT_SECRET,
      }),
    );
    if (!payload.ok) {
      return R.failure(
        payload.error instanceof TokenExpiredError
          ? OAuthError.Expired
          : OAuthError.Failed,
      );
    }
    const handoff = handoffSchema.safeParse(payload.value);
    if (
      !handoff.success ||
      handoff.data.provider !== params.provider ||
      !proofMatches(params.proof, handoff.data.proofHash)
    ) {
      return R.failure(OAuthError.Failed);
    }
    // Spent only once the proof has matched, so a handoff another app caught
    // cannot be burned out from under the app the flow belongs to.
    const first = await this.spentTokens.spend({
      credential: params.token,
      retainForMs: HANDOFF_LIFETIME_MS,
    });
    if (!first) {
      return R.failure(OAuthError.Failed);
    }
    const user = await this.userRepository.findOneBy({
      id: handoff.data.userId,
    });
    if (!user) {
      return R.failure(OAuthError.Failed);
    }
    return R.success({ user, outcome: handoff.data.outcome });
  }

  /**
   * Signs in, links, or creates, so one button covers a member who has never
   * used this provider here and one who has no account at all.
   */
  async authenticate(params: {
    profile: OAuthProfile;
    referralCode: string | undefined;
    timeZone: string;
  }): Promise<Result<OAuthAuthentication, OAuthError>> {
    const { profile } = params;
    const signedIn = await this.signIn(profile);
    if (
      signedIn.ok ||
      signedIn.error !== OAuthError.NoAccount ||
      !params.referralCode
    ) {
      return signedIn;
    }

    const created = await R.fromPromise(
      this.authService.createReferredUser({
        name: profile.name ?? profile.email,
        email: profile.email,
        password: null,
        timeZone: params.timeZone,
        referralCode: params.referralCode,
        oauth: profile,
      }),
    );
    // A spent or unknown invite throws from deep inside the signup path, and
    // the callback has nowhere to put an exception but the member's screen.
    if (!created.ok) {
      console.error("oauth signup failed", created.error);
      return R.failure(
        created.error instanceof BadRequestException
          ? OAuthError.InviteRequired
          : OAuthError.Failed,
      );
    }
    return R.success({ user: created.value, outcome: OAuthOutcome.SignedUp });
  }

  /** Signs in or links an existing member, and never creates an account. */
  async signIn(
    profile: OAuthProfile,
  ): Promise<Result<OAuthAuthentication, OAuthError>> {
    if (!profile.emailVerified) {
      return R.failure(OAuthError.EmailNotVerified);
    }

    const account = await this.accountRepository.findOne({
      where: { provider: profile.provider, subject: profile.subject },
    });
    if (account) {
      if (account.email !== profile.email) {
        await this.accountRepository.update(account.id, {
          email: profile.email,
        });
      }
      return R.success({
        user: await this.usersService.findOneOrFail(account.userId),
        outcome: OAuthOutcome.SignedIn,
      });
    }

    const byEmail = await this.usersService.findOneByEmail(profile.email);
    if (byEmail) {
      const linked = await this.link({ userId: byEmail.id, profile });
      if (!linked.ok) {
        return linked;
      }
      await this.userRepository.update(byEmail.id, { emailVerified: true });
      return R.success({
        user: await this.usersService.findOneOrFail(byEmail.id),
        outcome: OAuthOutcome.Linked,
      });
    }

    return R.failure(OAuthError.NoAccount);
  }

  /**
   * The checks {@link link} makes, on their own, for a native flow that wants
   * a reason on the member's screen at the callback but writes minutes later.
   */
  async linkable(params: {
    userId: number;
    profile: OAuthProfile;
  }): Promise<Result<void, OAuthError>> {
    const { profile } = params;
    if (!profile.emailVerified) {
      return R.failure(OAuthError.EmailNotVerified);
    }

    const claimant = await this.accountRepository.findOne({
      where: { provider: profile.provider, subject: profile.subject },
    });
    if (claimant && claimant.userId !== params.userId) {
      return R.failure(OAuthError.ClaimedByAnotherAccount);
    }

    // One row per (userId, provider), so writing a second account for the same
    // provider overwrites the first and silently retires it as a way in.
    const connected = await this.accountRepository.findOne({
      where: { userId: params.userId, provider: profile.provider },
    });
    if (connected && connected.subject !== profile.subject) {
      return R.failure(OAuthError.ProviderAlreadyConnected);
    }

    return R.success(undefined);
  }

  async link(params: {
    userId: number;
    profile: OAuthProfile;
  }): Promise<Result<User, OAuthError>> {
    const allowed = await this.linkable(params);
    if (!allowed.ok) {
      return allowed;
    }

    const { provider, subject, email } = params.profile;
    await this.accountRepository.upsert(
      { userId: params.userId, provider, subject, email },
      ["userId", "provider"],
    );
    return R.success(await this.usersService.findOneOrFail(params.userId));
  }

  async unlink(params: {
    userId: number;
    provider: OAuthProvider;
  }): Promise<Result<User, OAuthError>> {
    // The row lock makes a second disconnect wait for this one, so it counts
    // what is left after it rather than what was there before.
    const unlinked = await this.accountRepository.manager.transaction(
      async (manager) => {
        const user = await manager.getRepository(User).findOneOrFail({
          where: { id: params.userId },
          lock: { mode: "pessimistic_write" },
        });
        const accounts = manager.getRepository(OAuthAccount);
        const others = await accounts.countBy({
          userId: params.userId,
          provider: Not(params.provider),
        });
        if (!user.password && others === 0) {
          return false;
        }
        await accounts.delete({
          userId: params.userId,
          provider: params.provider,
        });
        return true;
      },
    );
    if (!unlinked) {
      return R.failure(OAuthError.LastSignInMethod);
    }
    return R.success(await this.usersService.findOneOrFail(params.userId));
  }
}
