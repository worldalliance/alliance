import {
  OAuthError,
  OAuthIntent,
  OAuthOutcome,
  type OAuthProvider,
} from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { BadRequestException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { Not, type Repository } from "typeorm";
import { AuthService } from "../auth.service";
import { JWTTokenType } from "../tokens";
import { OAuthAccount } from "./oauth-account.entity";
import type { OAuthProfile } from "./oauth-client";

export type OAuthState = {
  tokenType: JWTTokenType.oauthState;
  provider: OAuthProvider;
  intent: OAuthIntent;
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

export type OAuthProof = {
  proof: string;
  proofHash: string;
};

export type OAuthAuthentication = {
  user: User;
  outcome: OAuthOutcome;
};

const STATE_LIFETIME = "10m";

/**
 * Half of the proof that its holder is one user, handed to the app on a deep
 * link any other app on the device may be listening for. Useless without the
 * secret from the start call, and short-lived on top of that.
 */
const HANDOFF_LIFETIME_MS = 1000 * 60 * 2;

/**
 * What the callback still owes the app once the provider is done with. A
 * native client takes no cookies, so a session and a link both come back as one.
 */
export type OAuthHandoffPurpose =
  | { intent: OAuthIntent.Authenticate }
  | { intent: OAuthIntent.Link; profile: OAuthProfile };

export type OAuthHandoff = OAuthHandoffPurpose & {
  sub: number;
  tokenType: JWTTokenType.oauthHandoff;
  proofHash: string;
  jti: string;
};

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
  ) {}

  private readonly spentHandoffs = new Map<string, number>();

  signState(state: Omit<OAuthState, "tokenType">): Promise<string> {
    return this.jwtService.signAsync(
      { ...state, tokenType: JWTTokenType.oauthState },
      { expiresIn: STATE_LIFETIME },
    );
  }

  async verifyState(token: string): Promise<OAuthState | null> {
    const payload = await R.fromPromise(
      this.jwtService.verifyAsync<OAuthState>(token, {
        secret: process.env.JWT_SECRET,
      }),
    );
    if (!payload.ok || payload.value.tokenType !== JWTTokenType.oauthState) {
      return null;
    }
    return payload.value;
  }

  signHandoff(params: {
    userId: number;
    proofHash: string;
    purpose: OAuthHandoffPurpose;
  }): Promise<string> {
    const payload: OAuthHandoff = {
      ...params.purpose,
      sub: params.userId,
      tokenType: JWTTokenType.oauthHandoff,
      proofHash: params.proofHash,
      jti: randomBytes(16).toString("base64url"),
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: HANDOFF_LIFETIME_MS / 1000,
    });
  }

  /** One shot: a handoff that verifies here cannot be presented again. */
  async spendHandoff(params: {
    token: string;
    proof: string;
  }): Promise<OAuthHandoff | null> {
    const payload = await R.fromPromise(
      this.jwtService.verifyAsync<OAuthHandoff>(params.token, {
        secret: process.env.JWT_SECRET,
      }),
    );
    if (
      !payload.ok ||
      payload.value.tokenType !== JWTTokenType.oauthHandoff ||
      !proofMatches(params.proof, payload.value.proofHash) ||
      !this.markSpent(payload.value.jti)
    ) {
      return null;
    }
    return payload.value;
  }

  /**
   * False once the same handoff has been presented before. The set lives in
   * this process, which is the one process pm2 runs; a second instance would
   * let a handoff be spent once on each.
   */
  private markSpent(jti: string): boolean {
    const now = Date.now();
    for (const [spent, expiry] of this.spentHandoffs) {
      if (expiry <= now) {
        this.spentHandoffs.delete(spent);
      }
    }
    if (this.spentHandoffs.has(jti)) {
      return false;
    }
    this.spentHandoffs.set(jti, now + HANDOFF_LIFETIME_MS);
    return true;
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
      // A password on an account that never confirmed its address is nobody's
      // proven claim to it, and the provider just proved the address, so the
      // account changes hands and the password goes with it. unlink() refuses
      // a member's last way in, so this locks nobody out. A partial profile
      // from a payment finishes signing up here, as it does on the reset link.
      const takeover = byEmail.emailVerified
        ? {}
        : { password: null, isNotSignedUpPartialProfile: false };
      await this.userRepository.update(byEmail.id, {
        emailVerified: true,
        ...takeover,
      });
      return R.success({
        user: await this.usersService.findOneOrFail(byEmail.id),
        outcome: OAuthOutcome.Linked,
      });
    }

    if (!params.referralCode) {
      return R.failure(OAuthError.NoAccount);
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
    const user = await this.usersService.findOneOrFail(params.userId);
    const others = await this.accountRepository.countBy({
      userId: params.userId,
      provider: Not(params.provider),
    });
    if (!user.password && others === 0) {
      return R.failure(OAuthError.LastSignInMethod);
    }

    await this.accountRepository.delete({
      userId: params.userId,
      provider: params.provider,
    });
    return R.success(await this.usersService.findOneOrFail(params.userId));
  }
}
