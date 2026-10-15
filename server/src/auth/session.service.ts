import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import type { FindOptionsWhere, Repository } from "typeorm";
import { refusesReviewAccounts } from "./review-account";
import { generationOf, type JwtPayload } from "./tokens";

export function sessionAccount(params: {
  userId: number;
  sessionGeneration: number;
}): FindOptionsWhere<User> {
  return {
    id: params.userId,
    sessionGeneration: params.sessionGeneration,
    // Read on every request, so flagging an account in the database ends its
    // open sessions.
    ...(refusesReviewAccounts() && { isTestUser: false }),
  };
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** The session's account, unless it was deleted after the session began,
   * including when the account has since been restored. */
  async currentUser(session: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: this.accountOf(session),
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  /** {@link currentUser} for a caller that needs no more than the check. */
  async assertCurrent(session: JwtPayload): Promise<void> {
    if (!(await this.userRepository.existsBy(this.accountOf(session)))) {
      throw new UnauthorizedException();
    }
  }

  private accountOf(session: JwtPayload): FindOptionsWhere<User> {
    return sessionAccount({
      userId: session.sub,
      sessionGeneration: generationOf(session),
    });
  }
}
