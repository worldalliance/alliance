import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import type { FindOptionsWhere, Repository } from "typeorm";
import type { JwtPayload } from "./tokens";

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** The session's account, unless it was deleted after the session began. */
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
    return { id: session.sub };
  }
}
