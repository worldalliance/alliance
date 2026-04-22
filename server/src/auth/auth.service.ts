import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { ReferralSource, User } from '../user/entities/user.entity';
import { type PWResetJwtPayload, UserService } from '../user/user.service';
import { AuthTokens } from './dto/authtokens.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInResponseDto } from './dto/signin.dto';
import {
  extractAccessTokenFromCookie,
  extractTokenFromHeader,
} from './guards/auth.guard';
import {
  type GuestJwtPayload,
  type JwtPayload,
  JWTTokenType,
} from './guards/jwtreq';
import { OnetimeInvite } from 'src/user/entities/onetime-invite.entity';
import { ActionShareUrl } from 'src/actions/entities/action-share-url.entity';
import { Guest } from './entities/guest.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private mailService: MailService,
    @InjectRepository(ActionShareUrl)
    private actionShareUrlRepository: Repository<ActionShareUrl>,
    @InjectRepository(Guest)
    private guestRepository: Repository<Guest>,
  ) {}

  public static ACCESS_COOKIE = 'access_token';
  public static REFRESH_COOKIE = 'refresh_token';
  public static GUEST_COOKIE = 'guest_token';
  private static GUEST_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

  setAuthCookies(res: Response, access: string, refresh?: string) {
    const prod = process.env.NODE_ENV === 'production';

    res.cookie(AuthService.ACCESS_COOKIE, access, {
      httpOnly: true,
      secure: prod,
      path: '/',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 30, // 30 min
    });
    if (refresh) {
      res.cookie(AuthService.REFRESH_COOKIE, refresh, {
        httpOnly: true,
        secure: prod,
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });
    }
  }

  clearAuthCookies(res: Response) {
    res.clearCookie(AuthService.ACCESS_COOKIE, { path: '/' });
    res.clearCookie(AuthService.REFRESH_COOKIE, { path: '/' });
  }

  setGuestCookie(res: Response, token: string) {
    const prod = process.env.NODE_ENV === 'production';
    res.cookie(AuthService.GUEST_COOKIE, token, {
      httpOnly: true,
      secure: prod,
      sameSite: 'lax',
      path: '/',
      maxAge: AuthService.GUEST_COOKIE_MAX_AGE_MS,
    });
  }

  clearGuestCookie(res: Response) {
    res.clearCookie(AuthService.GUEST_COOKIE, { path: '/' });
  }

  async createGuestSession(
    existingToken?: string,
  ): Promise<{ guestId: string; guestToken: string }> {
    if (existingToken) {
      const payload = await this.verifyGuestToken(existingToken);
      if (payload) {
        const existing = await this.guestRepository.findOne({
          where: { id: payload.sub },
          relations: { linkedUser: true },
        });
        if (existing && !existing.linkedUser) {
          return { guestId: existing.id, guestToken: existingToken };
        }
      }
    }
    const guest = await this.guestRepository.save(
      this.guestRepository.create(),
    );
    const payload: GuestJwtPayload = {
      sub: guest.id,
      tokenType: JWTTokenType.guest,
    };
    const guestToken = await this.jwtService.signAsync(payload, {
      expiresIn: '30d',
    });
    return { guestId: guest.id, guestToken };
  }

  private static TOKEN_TYPE_IS_AUTHENTICATED: Record<JWTTokenType, boolean> = {
    [JWTTokenType.access]: true,
    [JWTTokenType.refresh]: false,
    [JWTTokenType.guest]: false,
  };

  async getAuthenticatedUserId(req: Request): Promise<number | null> {
    const token =
      extractTokenFromHeader(req) ?? extractAccessTokenFromCookie(req);
    if (!token) return null;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      if (!AuthService.TOKEN_TYPE_IS_AUTHENTICATED[payload.tokenType]) {
        return null;
      }
      return payload.sub;
    } catch {
      return null;
    }
  }

  async verifyGuestToken(token: string): Promise<GuestJwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<GuestJwtPayload>(
        token,
        {
          secret: process.env.JWT_SECRET,
        },
      );
      if (payload.tokenType !== JWTTokenType.guest) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async mergeGuestIntoUser(guestId: string, userId: number): Promise<void> {
    // Claim the guest atomically; only the first merger succeeds. Guest form
    // responses stay attached to the guest and are surfaced to the user as
    // drafts via TasksService.getLinkedGuestDraftFormResponse.
    await this.guestRepository
      .createQueryBuilder()
      .update(Guest)
      .set({ linkedUser: { id: userId } })
      .where('id = :guestId AND "linkedUserId" IS NULL', { guestId })
      .execute();
  }

  async mergeGuestFromToken(
    guestToken: string | undefined,
    userId: number,
  ): Promise<void> {
    if (!guestToken) return;
    const payload = await this.verifyGuestToken(guestToken);
    if (!payload) return;
    await this.mergeGuestIntoUser(payload.sub, userId);
  }

  /**
   * Resolves a referral code to invite (if onetime invite), referring user, and referral source.
   * Throws if code is missing, invite already used, or (outside test) invalid referral code.
   */
  private async resolveReferralCode(referralCode: string): Promise<{
    invite: OnetimeInvite | null;
    referringUser: User | null;
    referralSource: ReferralSource;
  }> {
    const invite = await this.usersService.findInviteByCode(referralCode, {
      invitingUser: { communities: true },
      community: true,
      invitedUser: true,
    });
    if (invite?.invitedUser) {
      throw new BadRequestException('This invite code has already been used');
    }
    if (invite) {
      await this.usersService.invalidateInvite(invite.id);
      return {
        invite,
        referringUser: invite.invitingUser,
        referralSource: ReferralSource.OnetimeInvite,
      };
    }
    const shareUrl = await this.actionShareUrlRepository.findOne({
      where: { sid: referralCode },
      relations: { user: true },
    });
    if (shareUrl?.user) {
      return {
        invite: null,
        referringUser: shareUrl.user,
        referralSource: ReferralSource.ActionShareLink,
      };
    }
    const referringUser =
      await this.usersService.findOneByReferralCode(referralCode);
    if (!referringUser && process.env.NODE_ENV !== 'test') {
      throw new BadRequestException('invalid referral code'); // TODO: feature flag
    }
    return {
      invite: null,
      referringUser,
      referralSource: ReferralSource.ReferralLink,
    };
  }

  async register(signUp: SignUpDto): Promise<User> {
    if (await this.usersService.findOneByEmail(signUp.email)) {
      throw new BadRequestException('User already exists');
    }

    if (!signUp.referralCode) {
      throw new BadRequestException('No referral code provided');
    }

    const { invite, referringUser, referralSource } =
      await this.resolveReferralCode(signUp.referralCode);

    const defaultTag = await this.usersService.findAllMembersTag();

    const user = await this.usersService.create({
      ...signUp,
      referredBy: referringUser ?? null,
      referredByInvite: invite ?? null,
      referralSource,
      tags: defaultTag ? [defaultTag] : undefined,
    });

    if (referringUser) {
      await this.usersService.makeFriendsAutomated(referringUser.id, user.id);
    }

    await this.usersService.sendWelcomeEmail(user.id);

    return user;
  }

  async login(
    email: string,
    password: string,
    adminOnly: boolean = false,
  ): Promise<SignInResponseDto & AuthTokens & { userId: number }> {
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      throw new UnauthorizedException();
    }

    if (!(await user.checkPassword(password))) {
      throw new UnauthorizedException();
    }

    if (adminOnly && !user.admin) {
      throw new UnauthorizedException();
    }

    return {
      access_token: await this.generateAccessToken(user),
      refresh_token: await this.generateRefreshToken(user),
      isAdmin: user.admin,
      userId: user.id,
    };
  }

  async generateRefreshToken(
    user: User,
    isImpersonation = false,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenType: JWTTokenType.refresh,
      ...(isImpersonation && { isImpersonation: true }),
    };
    const token = await this.jwtService.signAsync(payload, {
      expiresIn: '14d',
      secret: process.env.JWT_REFRESH_SECRET,
    });
    return token;
  }

  async generateAccessToken(
    user: User,
    isImpersonation = false,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenType: JWTTokenType.access,
      ...(isImpersonation && { isImpersonation: true }),
    };
    return this.jwtService.signAsync(payload, { expiresIn: '1d' });
  }

  async refreshTokens(
    userId: number,
    isImpersonation = false,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid user id');
    }
    return {
      access_token: await this.generateAccessToken(user, isImpersonation),
      refresh_token: await this.generateRefreshToken(user, isImpersonation),
    };
  }

  async getProfile(email: string): Promise<User> {
    const user = await this.usersService.findOneByEmail(email, {
      communities: true,
      invitedCommunities: true,
      contractEvents: true,
      city: true,
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      return; // fail silently to avoid leaking emails
    }

    const token = await this.usersService.generatePasswordResetToken(user.id);
    await this.mailService.sendPasswordResetEmail(user.email, user.name, token);
    return user;
  }

  async resetPassword(token: string, password: string) {
    let payload: PWResetJwtPayload;
    try {
      payload = this.jwtService.verify<PWResetJwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      console.log('password reset jwt verification error: ', error);
      throw new UnauthorizedException();
    }

    if (payload.type !== 'password-reset') {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    const updatedUser = await this.usersService.setPassword(user.id, password);

    if (updatedUser.isNotSignedUpPartialProfile) {
      await this.usersService.update(updatedUser.id, {
        isNotSignedUpPartialProfile: false,
      });
    }
  }

  async generateImpersonationTokens(
    userId: number,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      access_token: await this.generateAccessToken(user, true),
      refresh_token: await this.generateRefreshToken(user, true),
    };
  }
}
