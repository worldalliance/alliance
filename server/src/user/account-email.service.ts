import { BadRequestException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  JWTTokenType,
  type MailedJwtPayload,
  verifyMailedToken,
} from "src/auth/tokens";
import { updateLive } from "src/datasources/soft-delete";
import { MailService } from "src/mail/mail.service";
import { DataSource } from "typeorm";
import { User } from "./entities/user.entity";
import { UserService } from "./user.service";

@Injectable()
export class AccountEmailService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async sendWelcomeEmail(userId: number) {
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "staging") {
      return;
    }

    const user = await this.userService.findOneOrFail(userId);
    const token = await this.getVerifyEmailToken(userId);
    const mail = await this.mailService.sendWelcomeEmail({
      recipient: user.email,
      name: user.name,
      verifyToken: token,
    });
    await updateLive(this.dataSource.manager, {
      target: User,
      id: userId,
      changes: { welcomeMail: mail },
    });
  }

  async verifyEmail(token: string) {
    const userId = await verifyMailedToken(this.jwtService, {
      token,
      tokenType: JWTTokenType.verifyEmail,
    });
    if (
      !userId.ok ||
      !(await updateLive(this.dataSource.manager, {
        target: User,
        id: userId.value,
        changes: { emailVerified: true },
      }))
    ) {
      throw new BadRequestException("Invalid or expired verification link");
    }
  }

  async getVerifyEmailToken(userId: number) {
    const payload: MailedJwtPayload = {
      sub: userId,
      tokenType: JWTTokenType.verifyEmail,
    };
    return this.jwtService.sign(payload, {
      expiresIn: `7d`,
      secret: process.env.JWT_SECRET,
    });
  }
}
